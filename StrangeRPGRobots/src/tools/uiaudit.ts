// Interface audit for the browser harness. It opens every menu screen, dialogue box, choice list, fight state,
// card game state, and the credits, and records text that overlaps, touches, or is cut off.
// Run in a fresh page: await __h.uiAudit(). Parts can be picked: await __h.uiAudit(['menus', 'combat']).
// Progress is in globalThis.__audProgress. Set globalThis.__audStop = true to end early with partial results.
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Issue } from '../engine/layout';

export type Part = 'field' | 'dialogue' | 'choices' | 'menus' | 'travel' | 'shops' | 'combat' | 'sluice' | 'overlays' | 'credits';
const ALL: Part[] = ['field', 'dialogue', 'choices', 'menus', 'travel', 'shops', 'combat', 'sluice', 'overlays', 'credits'];

export async function uiAudit(h: any, parts: Part[] = ALL): Promise<{ issues: Record<string, Issue[]>; states: number; partial: boolean }> {
  const M = await h.mods();
  const issues: Record<string, Issue[]> = {};
  const seen = new Set<string>();
  let states = 0;
  const g = globalThis as any;
  g.__audStop = false;
  const t0 = performance.now();
  const snap = (label: string, ignore: Issue['kind'][] = []) => {
    states++;
    g.__audProgress = { states, label, seconds: Math.round((performance.now() - t0) / 1000), found: Object.keys(issues).length };
    if (g.__audStop) throw new Error('stopped');
    const fresh = (h.audit() as Issue[]).filter((i) => !ignore.includes(i.kind)).filter((i) => {
      const k = `${i.kind}|${i.a}|${i.b ?? ''}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    if (fresh.length) issues[label] = [...(issues[label] ?? []), ...fresh];
  };
  const G = () => M.state.G;
  const stack = () => M.menus.MENU.stack;
  const top = () => stack()[stack().length - 1];
  const clear = () => { M.dialogue.clearDialogue(); M.menus.closeMenu(); };

  await h.setup({ name: 'Lode' });
  await h.step(10);
  await h.idle();
  clear();
  // A full save: every companion, item, quest, faction, lore entry, card, and map, with wide numbers.
  for (const m of M.maps.MAPS.values()) { m.enter = undefined; G().flags['visited_' + m.id] = 1; }
  M.replay.EVENTS.length = 0;
  for (const id of Object.keys(M.companions.COMPANIONS)) M.runner.joinParty(id);
  for (const m of Object.values(G().roster) as any[]) m.level = 12;
  G().gilt = 98765;
  for (const id of M.rules.ITEM.keys()) G().items[id] = 12;
  M.quests.QUESTS.forEach((q: any, n: number) => {
    const keys = Object.keys(q.stages).filter((k) => k !== 'done' && k !== 'fail');
    const st = n % 3 === 0 ? 'done' : keys[keys.length - 1] ?? 'done';
    G().quests[q.id] = { stage: Number(st) || 0, done: st === 'done', log: Object.values(q.stages) as string[], seen: true };
  });
  G().rep = {};
  M.replay.FACTIONS.forEach((f: any, n: number) => { G().rep[f.id] = [-10, -4, 0, 4, 10][n % 5]; });
  for (const id of M.dcontent.LORE.keys()) M.details.unlockLore(id);
  for (const d of M.dcontent.DETAILS) G().flags['det_' + d.id] = 1;
  G().cards = {};
  for (const c of M.cards.CARDS) G().cards[c.id] = 2;
  clear();
  await h.step(5);
  // Hidden tabs throttle timers, so the audit yields to the page through a message channel instead.
  let calls = 0;
  const yieldNow = () => new Promise<void>((r) => { const c = new MessageChannel(); c.port1.onmessage = () => r(); c.port2.postMessage(0); });
  const step = async (k = 1) => { await h.step(k); if (++calls % 10 === 0) await yieldNow(); };
  let partial = false;
  try {

  if (parts.includes('field')) {
    for (const def of M.maps.MAPS.values() as Iterable<any>) {
      const marker = Object.keys(def.markers ?? {})[0];
      if (!marker) continue;
      void M.runner.stage.warp(def.id, marker);
      await step(50);
      M.dialogue.clearDialogue();
      snap(`field ${def.id}`);
      h.hold('map', true);
      await step(2);
      snap(`field ${def.id}, interactables marked`);
      h.hold('map', false);
      await step(2);
    }
    const quests = M.quests.QUESTS.map((q: any) => q.title as string).sort((a: string, b: string) => b.length - a.length);
    for (const t of quests.slice(0, 4)) M.dialogue.toast(`New: ${t}`);
    snap('notices, longest quest titles');
    M.dialogue.clearDialogue();
  }

  if (parts.includes('dialogue')) {
    const long = 'This line runs long on purpose, so the box has to wrap it across several rows and turn the page at least once before it ends.';
    for (const id of Object.keys(M.speakers.SPEAKERS)) {
      void M.dialogue.say(id, long);
      await step(150);
      snap(`dialogue, speaker ${id}`);
      M.dialogue.clearDialogue();
    }
    void M.dialogue.say('PORT', long); await step(150); snap('dialogue, port'); M.dialogue.clearDialogue();
    void M.dialogue.say('', long); await step(150); snap('dialogue, system'); M.dialogue.clearDialogue();
    for (const pool of [3, 9, 14]) {
      const skill = (Object.values(M.rules.SKILL_NAME) as string[]).sort((x, y) => y.length - x.length)[0];
      const helper = (Object.values(G().roster) as any[]).map((m) => m.name as string).sort((x, y) => y.length - x.length)[0];
      void M.dialogue.rollCheck(`${helper}: ${skill} ${pool} dice`, pool, 4, 3, `${helper} helps: +1 die`);
      await step(120);
      snap(`skill roll, pool ${pool}`);
      M.dialogue.clearDialogue();
    }
  }

  if (parts.includes('choices')) {
    for (const sc of h.SCENES.values() as Iterable<any>) {
      for (const L of sc.lines) {
        if (L.k !== 'choice') continue;
        const opts = L.opts.map((o: any) => ({
          text: o.text,
          tag: o.check ? `[${M.rules.SKILL_NAME[o.check.skill]} ${o.check.need}]` : o.party ? `[${G().roster[o.party]?.name ?? o.party}]` : o.cls ? `[${o.cls[0].toUpperCase()}${o.cls.slice(1)}]` : o.cost ? `[${o.cost} gilt]` : undefined,
          enabled: true,
        }));
        void M.dialogue.choose(L.prompt, opts);
        snap(`choices ${sc.id}:${L.n}`);
        M.dialogue.clearDialogue();
      }
    }
  }

  if (parts.includes('menus')) {
    const open = async (i: number) => { clear(); M.menus.openMenu(); stack()[0].sel = i; await step(2); snap(`menu, main on item ${i}`); h.press('a'); await step(3); };
    const members = (): number => Object.keys(G().roster).length;
    await open(0);
    for (let i = 0; i < members(); i++) {
      top().i = i; top().mode = 'view'; await step(1); snap(`party, member ${i}`);
      top().mode = 'perk'; for (let p = 0; p < 12; p++) { top().perkSel = p; await step(1); snap(`party, member ${i}, perk ${p}`); }
      top().mode = 'attr'; for (let p = 0; p < 6; p++) { top().attrSel = p; await step(1); snap(`party, member ${i}, attribute ${p}`); }
      top().mode = 'view';
      for (let s = 0; s < 8; s++) { top().scroll = s; await step(1); snap(`party, member ${i}, scroll ${s}`); }
      top().scroll = 0;
    }
    await open(1);
    for (let i = 0; i < members(); i++) {
      for (let s = 0; s < 6; s++) {
        top().i = i; top().slot = s; top().picking = false; await step(1); snap(`gear, member ${i}, slot ${s}`);
        top().picking = true;
        for (let p = 0; p < 30; p++) { top().pick = p; await step(1); snap(`gear, member ${i}, slot ${s}, pick ${p}`); }
        top().picking = false;
      }
    }
    await open(2);
    for (let i = 0; i < M.rules.ITEM.size; i++) { top().sel = i; top().target = -1; await step(1); snap(`items, row ${i}`); }
    top().sel = 0; top().target = 0; await step(1); snap('items, choosing a target');
    await open(3);
    for (let tab = 0; tab < 4; tab++) {
      for (let i = 0; i < 160; i++) { top().tab = tab; top().sel = i; await step(1); snap(`journal, tab ${tab}, row ${i}`); }
    }
    for (const L of M.dcontent.LORE.values() as Iterable<any>) {
      clear(); M.menus.pushScreen(new M.menus.ReadScreen(L.title, L.text));
      for (let s = 0; s < 4; s++) { top().scroll = s; await step(1); snap(`lore page ${L.id ?? L.title}, scroll ${s}`); }
    }
    await open(4);
    for (let i = 0; i < 4; i++) { top().sel = i; await step(1); snap(`rest, row ${i}`); }
    await open(5); for (let i = 0; i < 10; i++) { top().sel = i; await step(1); snap(`save slots, row ${i}`); }
    await open(6); for (let i = 0; i < 10; i++) { top().sel = i; await step(1); snap(`load slots, row ${i}`); }
    await open(7); for (let i = 0; i < 12; i++) { top().sel = i; await step(1); snap(`options, row ${i}`); }
    await open(8); snap('quit confirm');
    clear(); M.menus.pushScreen(new M.menus.PartyPick());
    for (let i = 0; i < 12; i++) { top().sel = i; await step(1); snap(`party pick, row ${i}`); }
    clear();
  }

  if (parts.includes('travel')) {
    // Destinations depend on the chapter, so every chapter gets its own list.
    const chapter = G().chapter;
    for (let ch = 1; ch <= 6; ch++) {
      G().chapter = ch;
      clear(); M.menus.pushScreen(new M.menus.TravelScreen(() => {}, () => {}));
      const n = top().list.length;
      if (!n) issues[`travel, chapter ${ch}`] = [{ kind: 'clip', a: 'empty travel list', x: 0, y: 0 }];
      for (let i = 0; i < n; i++) { top().sel = i; await step(1); snap(`travel, chapter ${ch}, row ${i}`); }
    }
    G().chapter = chapter;
    clear();
  }

  if (parts.includes('shops')) {
    for (const id of M.shops.SHOPS.keys()) {
      for (const sell of [false, true]) {
        clear(); M.menus.pushScreen(new M.menus.ShopScreen(id, () => {}));
        top().sell = sell;
        for (let i = 0; i < 40; i++) { top().sel = i; await step(1); snap(`shop ${id}${sell ? ', selling' : ''}, row ${i}`); }
      }
    }
    clear();
  }

  if (parts.includes('combat')) {
    const fights: [string, string][] = [];
    for (const def of M.maps.MAPS.values() as Iterable<any>) {
      const enc = (def.encounters ?? []).slice().sort((a: any, b: any) => b.units.length - a.units.length)[0];
      if (enc && def.markers) fights.push([def.id, enc.id]);
    }
    const CB = M.core.CB, PI = M.combat.PI;
    const playerTurn = () => CB.active && CB.cur && CB.cur.side === 'party' && PI.resolve && !PI.acting;
    for (const [map, enc] of fights.slice(0, 8)) {
      clear();
      void M.runner.stage.warp(map, Object.keys(M.maps.MAPS.get(map).markers)[0]);
      await step(50);
      clear();
      void M.runner.fightNow([enc], false);
      for (let t = 0; t < 4; t++) {
        for (let k = 0; k < 1500 && !playerTurn() && CB.active; k++) await step(1);
        if (!playerTurn()) break;
        const who = CB.cur.name;
        snap(`fight ${enc}, ${who}'s turn`);
        for (const key of ['n1', 'n2', 'n3', 'n4', 'n5', 'n6', 'n7', 'n8', 'n9', 'n0']) {
          h.press(key); await step(2); snap(`fight ${enc}, ${who}, bar ${key}`);
          if (PI.mode === 'items') for (let i = 0; i < 20; i++) { PI.itemSel = i; await step(1); snap(`fight ${enc}, ${who}, item ${i}`); }
          h.press('b'); await step(2);
        }
        PI.showOrder = 1; await step(1); snap(`fight ${enc}, turn order`);
        for (const u of CB.units) { PI.cx = u.x; PI.cy = u.y; await step(1); snap(`fight ${enc}, ${who}, cursor on ${u.name}`); }
        h.press('end'); await step(5);
      }
      if (CB.active) {
        for (const u of CB.units) if (u.side !== 'party') u.hp = 0;
        for (let k = 0; k < 600 && CB.active; k++) { await step(1); if (k % 30 === 0) snap(`fight ${enc}, ending`); }
      }
      for (let k = 0; k < 300 && (M.dialogue.dialogueOpen() || M.menus.menuOpen()); k++) { snap(`after fight ${enc}`); h.press('a'); await step(3); }
      clear();
    }
  }

  if (parts.includes('sluice')) {
    const OV = M.runner.OV;
    for (const op of M.cards.OPPONENTS) {
      clear();
      OV.sluice = new M.sluice.Sluice(op.id);
      const S = OV.sluice;
      for (let i = 0; i < 40; i++) { S.deckSel = i; await step(1); snap(`sluice vs ${op.id}, deck row ${i}`); }
      h.press('end'); await step(20);
      for (let k = 0; k < 60 && S.phase === 'play'; k++) {
        for (let c = 0; c < 9; c++) if (!S.board[c]) { S.cell = c; break; }
        for (let s = 0; s < 5; s++) { S.sel = s; await step(1); snap(`sluice vs ${op.id}, hand ${s}`); }
        S.sel = 0; h.press('a'); await step(60); snap(`sluice vs ${op.id}, after a move`);
      }
      for (let k = 0; k < 120 && !S.done; k++) { await step(1); if (k % 20 === 0) snap(`sluice vs ${op.id}, result`); }
      OV.sluice = null;
    }
  }

  if (parts.includes('overlays')) {
    const OV = M.runner.OV;
    for (const sc of h.SCENES.values() as Iterable<any>) {
      for (const L of sc.lines) {
        if (L.k !== 'cmd' || L.name !== 'chapter') continue;
        OV.card = { n: Number(L.args[0]), title: L.args.slice(1).join(' '), t: 1 };
        await step(1);
        snap(`chapter card ${OV.card.n}: ${OV.card.title}`);
      }
    }
    OV.card = null;
    OV.gameOver = true; await step(1); snap('game over'); OV.gameOver = false;
    await step(2);
  }

  if (parts.includes('credits')) {
    const OV = M.runner.OV;
    clear();
    OV.ending = true;
    for (let k = 0; k < 60 * 120 && OV.ending; k++) { await step(1); if (k % 20 === 0) snap(`credits, frame ${k}`, ['offscreen']); }
  }

  } catch (e) {
    if ((e as Error).message !== 'stopped') throw e;
    partial = true;
  }
  clear();
  return { issues, states, partial };
}
