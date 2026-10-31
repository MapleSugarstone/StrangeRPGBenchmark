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
  prisingiron: 'An iron bar with a hooked end. Face a crust of old shells and press to pry it off.',
  stilts: 'Two poles with steps. Ouro wades the shallows. Deep water still needs a TIDE whorl.',
  jingle: 'A hoop made of thin, jingling shells. Press it against a large sleeper to wake it.',
  haul: 'A harness attached to a rope. Grip the haul stone and pull back to drag it.',
  letter: 'A letter sealed with a black spiral. The Gate Ring\'s keeper opens the way for it.',
  whelk: 'An empty whelk shell, large enough for a crab to inhabit. It rattles when shaken.',
  lore_kettle: 'Salt fringed the spout. It boiled on an island that never stopped walking.',
  lore_door: 'It washed into the bay the year before the sea shed. The knocker is a scallop. (It still knocks.)',
  lore_window: 'Four panes. Three display the Rim. The fourth is cracked, revealing it twice.',
  lore_chair: 'A sleeper slept on it for years. One leg is shorter now.',
  lore_vane: 'A tin fish mounted on a pole. It points toward the Rimwater, regardless of the wind\'s direction.',
  lore_tub: 'Frozen during a harsh winter, with the laundry still inside. The clothes are fine.',
  lore_step: 'A flat stone, worn into a depression by a single pair of feet over fifty years.',
  lore_gate: 'It rolled up to the star, joining the rest. The latch still holds.',
});

/** The eight things that fell off Holm's back, in the order Ouro can reach them. */
export const LORE = ['lore_kettle', 'lore_door', 'lore_window', 'lore_chair', 'lore_vane', 'lore_tub', 'lore_step', 'lore_gate'];

/** What each key item opens or where it goes, said once when Ouro gets it. */
const KEY_FOR: Record<string, string> = {
  prisingiron: 'It pries old shell crusts from rocks and doorways.',
  stilts: 'They wade through the shallows, avoiding deep water.',
  jingle: 'It wakes a large sleeper blocking the path.',
  haul: 'It hauls the heavy stones.',
  chart: 'Check the Bag to see the bay as it was before the dry.',
  whelk: 'A crab searching for a new home might find it appealing.',
};
for (const k of LORE) KEY_FOR[k] = 'This goes back to the Islander at Cockle Cove.';

export async function giveKeyItem(k: string, line?: string): Promise<void> {
  if (!G.keys.includes(k)) G.keys.push(k);
  sfx('level');
  const said = line || `Ouro gets ${KEY_NAMES[k] ? KEY_NAMES[k].replace(/^The /, 'the ') : k}.`;
  await notice(KEY_FOR[k] ? `${said} ${KEY_FOR[k]}` : said);
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
  if (!hasKey('haul')) { void f.runBusy(async () => { sound('bump'); await hint('It\'s too heavy to move by hand. You\'d need a harness.'); }); return true; }
  if (f.held === o) { f.held = null; sfx('back'); return true; }
  f.held = o;
  sfx('guard');
  if (!flag('haulTold')) {
    setFlag('haulTold');
    void f.runBusy(async () => {
      await hint('(Ouro is holding the stone. If you back away, it follows. Turn away or push again to release it.)');
      await hint('(Step toward a stone you\'re holding when there\'s deep water beyond it, and it will tip in and sink.)');
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
  const c = await choose(['Catch it', 'Let it wander off']);
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
  beachglass: 'And beach glass. Green goes for fifty. I\'d say forty for clear, and I mean it.',
  saltcake: 'Plus a salt cake. Seventy-five, minus what I\'ve tasted.',
  ridertin: 'Which is a Rider tin. Sealed shut. One-fifty, and I won\'t open it.',
  bellchip: 'And a bell chip. It hums in the palm. One-eighty-seven, with the hum as a bonus.',
  rainjar: 'Plus a jar of upward rain! Four hundred. These won\'t last.',
  moonsilt: 'Which is moon silt. Three hundred and twelve. It sinks upward, so watch the lid.',
  starglass: 'And star glass. Five hundred. I can see my entire stall in it, along with my debts.',
  ambergris: 'Plus ambergris. Seven-fifty. It smells like a very long afternoon.',
};

async function sellMenu(): Promise<void> {
  const monger = field.map.id === 'fellmonger';
  for (;;) {
    const have = Object.keys(ITEMS).filter(id => (G.items[id] || 0) > 0 && ITEMS[id].sell > 0);
    if (!have.length) { await say(monger ? 'Strandmonger' : 'Shellwright', monger ? 'That\'s everything. Splendid.' : 'That\'s the whole lot. Cheers.'); return; }
    const price = (id: string) => id === 'rainjar' && monger ? 400 : Math.round(ITEMS[id].sell * (monger ? 1.25 : 1));
    const i = await listMenu(`Sell  (${G.rind} cowries)`, have.map(id => `${ITEMS[id].name} x${G.items[id]}  ${price(id)}`), { w: 170 });
    if (i < 0) return;
    const id = have[i];
    const n = await choose(['One', 'Everything'], true, `${ITEMS[id].name}: ${price(id)} cowries each.`);
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
  if (!field.map.zone) { await hint('(No wild beasts live here to keep off.)'); return false; }
  spend('saltline');
  G.flags.saltLine = 150;
  sound('wind');
  await emote('ouro', 'silence');
  return true;
};
ITEMS.lure.use = async () => {
  if (!field.map.zone) { await hint('(No wild beasts live here to lure.)'); return false; }
  spend('lure');
  field.lureMap = field.map.id;
  sound('ok');
  bell(24);
  await emote('ouro', 'music');
  return true;
};
ITEMS.whistle.use = async () => {
  if (!outdoorVolute()) { await hint('(The cart can\'t reach this spot. It requires a road, or at least a beach.)'); return false; }
  if (Object.keys(TOWNS).filter(k => G.flags['visited_' + k]).length < 2) { await hint('(The cart only travels between towns Ouro has visited.)'); return false; }
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
    if (await choose(['Fight it', 'Let it go']) !== 0) return;
    const r = await fightWild(mon(kind, lv));
    if (r.pegged.length) await giveMon(r.pegged[0]);
    if (r.result === 'lose') { await field.lose(); return; }
    if (r.result !== 'run') { setFlag('met_' + id); save(); }
  });
  return { id, x, y, sprite: 'stone', mon: kind, name: SPECIES[kind]?.name || kind, talk: id, wander: true, when: () => !flag('met_' + id) };
}

void MAPS;
