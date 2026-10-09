// The ring round the Lipwater: key items, crusts, haul stones, sleepers, gatehouses, the Sell counter, and field items.
import { sfx } from '../engine/audio';
import { SPECIES } from '../data/species';
import { bell, cart, choose, emote, field, fightWild, flag, giveMon, hint, mon, moveNpc, narr, notice, say, setFlag, sound, tanneryExtras, TOWNS, wait, walkAway } from '../game/api';
import { crustKey, type Field } from '../game/field';
import { G, save } from '../game/state';
import { ITEMS } from '../game/items';
import { KEY_NAMES, KEY_TEXT, listMenu } from '../game/menus';
import { defScript, MAPS, type Script } from '../game/world';
import { reward, type Reward } from './areakit';

export const hasKey = (k: string): boolean => G.keys.includes(k);

/** The hollow on the Dry Sea's bed where the Master's chart circles the deepest sounding. The door is buried there. */
export const CHART_HOLLOW: [number, number] = [33, 25];

// ---------------------------------------------------------------- key items

Object.assign(KEY_NAMES, {
  prisingiron: 'Prising iron', stilts: 'Wading stilts', jingle: 'The jingle', haul: 'The haul', chart: 'The Master\'s chart',
  whelk: 'Big whelk shell',
  lore_kettle: 'The kettle', lore_door: 'The door', lore_window: 'The window', lore_chair: 'The chair',
  lore_vane: 'The weathervane', lore_tub: 'The washtub', lore_step: 'The front step', lore_gate: 'The gate',
});
Object.assign(KEY_TEXT, {
  prisingiron: 'A flat bar of iron with a bent end. Face a crust of old shells and press to prise it off.',
  stilts: 'Two poles with steps on them. Ouro wades shallows on them. Deep water still wants a TIDE whorl.',
  jingle: 'A hoop of thin jingle shells. Face a big sleeper and press, and it wakes.',
  haul: 'A harness and a rope. Press at a haul stone to take hold, and back away to drag it.',
  letter: 'A letter sealed with a black spiral. A gatekeeper of the Gate Ring opens for it.',
  whelk: 'An empty whelk shell, big enough for a crab to live in. It rattles.',
  lore_kettle: 'Salt grew on the spout in a frill. It boiled on the back of an island that never stopped walking.',
  lore_door: 'It fell in the bay the year before the sea turned. The knocker is a scallop. (it still knocks)',
  lore_window: 'Four panes. Three show the Lip. The fourth is cracked and shows it twice.',
  lore_chair: 'A sleeper slept on it for some years. One leg is shorter now.',
  lore_vane: 'A tin fish on a pole. It points at the Lipwater whichever way the wind is.',
  lore_tub: 'Frozen in a cold year with the washing still in it. The washing is fine.',
  lore_step: 'A flat stone worn into a dip by one pair of feet over fifty years.',
  lore_gate: 'It rolled to the star with everything else. It still latches.',
});

/** The eight things that fell off Holm's back, in the order Ouro can reach them. */
export const LORE = ['lore_kettle', 'lore_door', 'lore_window', 'lore_chair', 'lore_vane', 'lore_tub', 'lore_step', 'lore_gate'];

export async function giveKeyItem(k: string, line?: string): Promise<void> {
  if (!G.keys.includes(k)) G.keys.push(k);
  sfx('level');
  await notice(line || `Ouro gets ${KEY_NAMES[k] ? KEY_NAMES[k].replace(/^The /, 'the ') : k}.`);
  save();
}

// ---------------------------------------------------------------- crusts

/** What a crust gives when it comes off, by map and tile. */
export const CRUST_FINDS: Record<string, Reward> = {};

async function prise(f: Field, x: number, y: number): Promise<void> {
  if (!hasKey('prisingiron')) { sound('bump'); await emote('ouro', 'sweat'); return; }
  sfx('cut');
  await wait(12);
  sfx('cut');
  f.shakeT = 8;
  G.flags[crustKey(f.map.id, x, y)] = 1;
  await wait(16);
  const r = CRUST_FINDS[`${f.map.id}:${x},${y}`];
  if (r) await reward(r);
  save();
}

field.tileHandlers.push((f, x, y, ch) => {
  if (ch !== '%') return false;
  void f.runBusy(() => prise(f, x, y));
  return true;
});

// ---------------------------------------------------------------- haul stones

field.tileHandlers.push((f, x, y, ch) => {
  if (ch !== '@') return false;
  const o = f.objAt(x, y);
  if (!o) return false;
  if (!hasKey('haul')) { void f.runBusy(async () => { sound('bump'); await hint('Too heavy to shift by hand. A harness would do it.'); }); return true; }
  if (f.held === o) { f.held = null; sfx('back'); return true; }
  f.held = o;
  sfx('guard');
  if (!flag('haulTold')) {
    setFlag('haulTold');
    void f.runBusy(async () => {
      await hint('(Ouro has hold of the stone. Back away and it follows. Turn aside or press again to let go.)');
      await hint('(Step toward a held stone with deep water past it, and it tips in and sinks.)');
    });
  }
  return true;
});

// ---------------------------------------------------------------- sleepers

defScript('sleeper', async () => {
  const d = field.talkNpc;
  const s = d?.sleeper;
  if (!s) return;
  const name = SPECIES[s.kind]?.name || s.kind;
  if (!hasKey('jingle')) { await emote('ouro', 'silence'); return; }
  // The jingle rings, the sleeper turns to face Ouro, and either fights or gets up and walks away until it is off the screen.
  sfx('blip'); await wait(6); sfx('blip'); await wait(6); sfx('blip');
  await wait(20);
  const n = field.npc(d!.id);
  if (n) n.dir = (field.dir + 2) % 4;
  sfx('spot');
  const c = await choose(['Sound it', 'Let it walk off']);
  if (c === 0) {
    const r = await fightWild(mon(s.kind, s.lv));
    if (r.pegged.length) await giveMon(r.pegged[0]);
    if (r.result === 'lose') { await field.lose(); return; }
    if (r.result === 'run') return;
  } else if (n) await walkAway(d!.id);
  setFlag(s.flag);
  save();
});

// ---------------------------------------------------------------- gatehouses

/** The four gates of the Gate Ring, by the flag that holds each open. */
export const GATES = { s: 'gate_s', w: 'gate_w', n: 'gate_n', e: 'gate_e' } as const;

/** A gatekeeper on a gate's outer side. The letter from the Apex opens the gate for good. */
export function gatekeeper(gate: keyof typeof GATES, hand: string, lines: { shut: string; read: string; open: string }): Script {
  return async () => {
    const f = GATES[gate];
    if (flag(f)) { await say('Gatekeeper', lines.open); return; }
    if (!hasKey('letter')) { await say('Gatekeeper', lines.shut); return; }
    // Ouro shows the letter, the gatekeeper reads the seal, and the gate tile opens with a shake.
    sfx('page');
    await wait(40);
    await say('Gatekeeper', lines.read);
    sfx('boom');
    field.shakeT = 20;
    setFlag(f);
    await wait(20);
    void hand;
    save();
  };
}

// ---------------------------------------------------------------- the Sell counter

/** What the Strandmonger says as he prices a find out loud. */
const PRICED: Record<string, string> = {
  beachglass: 'And beach glass. Green, so fifty. Clear I\'d have said forty and meant it.',
  saltcake: 'Plus a salt cake. Seventy-five, less what I licked.',
  ridertin: 'Which is a Rider tin. Sealed. One fifty, and I\'ll never open it.',
  bellchip: 'And a bell chip. Hums in the hand. One eighty-seven, and the hum\'s extra.',
  rainjar: 'Plus a jar of upward rain! Four hundred. There\'ll be no more of these.',
  moonsilt: 'Which is moon silt. Three hundred and twelve. It sinks upward, so mind the lid.',
  starglass: 'And star glass. Five hundred. I can see my whole stall in it, and the debts.',
  ambergris: 'Plus ambergris. Seven fifty. It smells of a very big afternoon.',
};

async function sellMenu(): Promise<void> {
  const monger = field.map.id === 'fellmonger';
  for (;;) {
    const have = Object.keys(ITEMS).filter(id => (G.items[id] || 0) > 0 && ITEMS[id].sell > 0);
    if (!have.length) { await say(monger ? 'Strandmonger' : 'Shellwright', monger ? 'And that\'s the lot. Lovely.' : 'That\'s all of it. Ta.'); return; }
    const price = (id: string) => id === 'rainjar' && monger ? 400 : Math.round(ITEMS[id].sell * (monger ? 1.25 : 1));
    const i = await listMenu(`Sell  (${G.rind} cowries)`, have.map(id => `${ITEMS[id].name} x${G.items[id]}  ${price(id)}`), { w: 170 });
    if (i < 0) return;
    const id = have[i];
    const n = await choose(['One', 'All of them'], true, `${ITEMS[id].name}: ${price(id)} cowries each.`);
    if (n < 0) continue;
    if (monger && PRICED[id]) await say('Strandmonger', PRICED[id]);
    const k = n === 0 ? 1 : G.items[id];
    G.items[id] -= k;
    G.rind += price(id) * k;
    sfx('ok');
    await notice(`${k} sold for ${price(id) * k} cowries.`);
    save();
  }
}

tanneryExtras.push({ label: 'Sell', when: () => Object.keys(ITEMS).some(id => (G.items[id] || 0) > 0 && ITEMS[id].sell > 0), run: sellMenu });

// ---------------------------------------------------------------- field items

const outdoorVolute = () => !field.map.indoor && !field.map.strand && !field.map.dark;
function spend(id: string): void { G.items[id] = Math.max(0, (G.items[id] || 0) - 1); }

ITEMS.saltline.use = async () => {
  if (!field.map.zone) { await hint('(Nothing wild lives here to keep off.)'); return false; }
  spend('saltline');
  G.flags.saltLine = 150;
  sound('wind');
  await emote('ouro', 'silence');
  return true;
};
ITEMS.lure.use = async () => {
  if (!field.map.zone) { await hint('(Nothing wild lives here to lure.)'); return false; }
  spend('lure');
  field.lureMap = field.map.id;
  sound('ok');
  bell(24);
  await emote('ouro', 'music');
  return true;
};
ITEMS.whistle.use = async () => {
  if (!outdoorVolute()) { await hint('(The cart can\'t come here. It needs a road, or at least a beach.)'); return false; }
  if (Object.keys(TOWNS).filter(k => G.flags['visited_' + k]).length < 2) { await hint('(The cart only goes between towns Ouro has been to.)'); return false; }
  const at = G.map;
  await emote('ouro', 'music');
  sound('step');
  await wait(20);
  await cart();
  if (G.map !== at) spend('whistle');
  return true;
};

// ---------------------------------------------------------------- small helpers

/** A plain room ten tiles by eight with its door in the middle of the bottom wall. */
export function room(rowsInside: string[]): string[] {
  return ['##########', ...rowsInside.map(r => '#' + r.padEnd(8, '_').slice(0, 8) + '#'), '####dd####'];
}

/** The door out of a ten by eight room, back to a tile outside. */
export function roomDoor(to: string, x: number, y: number): { x: number; y: number; to: string; tx: number; ty: number; dir: number }[] {
  return [{ x: 4, y: 7, to, tx: x, ty: y, dir: 0 }, { x: 5, y: 7, to, tx: x, ty: y, dir: 0 }];
}

/** A wild whorl that stands in one place until Ouro fights it once. */
export function standingWild(id: string, x: number, y: number, kind: string, lv: number): import('../game/world').NpcDef {
  defScript(id, async () => {
    await emote(id, 'surprise');
    if (await choose(['Fight it', 'Leave it']) !== 0) return;
    const r = await fightWild(mon(kind, lv));
    if (r.pegged.length) await giveMon(r.pegged[0]);
    if (r.result === 'lose') { await field.lose(); return; }
    if (r.result !== 'run') { setFlag('met_' + id); save(); }
  });
  return { id, x, y, sprite: 'stone', mon: kind, name: SPECIES[kind]?.name || kind, talk: id, wander: true, when: () => !flag('met_' + id) };
}

void MAPS;
