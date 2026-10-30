// Plays party banter: a short scene of speaker lines shown over the companions' heads while the player walks.
import { BANTER, type Banter } from '../content/banter';
import { speaker, PORT_SPEAKER } from '../content/speakers';
import { SCENES, sceneRunning } from './script';
import { G, flag } from './state';
import { MAPS } from '../world/map';
import { F, findActor } from '../world/field';
import { dialogueOpen } from '../ui/dialogue';
import { menuOpen } from '../ui/menus';
import { C } from '../engine/palette';

const B = {
  pending: null as null | { b: Banter; wait: number },
  playing: null as null | { b: Banter; lines: { who: string; text: string }[]; i: number; t: number; actor?: string },
};

function eligible(b: Banter, mapId: string): boolean {
  const def = MAPS.get(mapId);
  if (!def || G.flags['banter_' + b.scene] || !SCENES.has(b.scene)) return false;
  if (b.maps && !b.maps.includes(mapId)) return false;
  if (b.district && (b.district === 'inside' ? !def.inside : def.district !== b.district || def.inside)) return false;
  if (b.when && !flag(b.when)) return false;
  return b.party.every((p) => G.party.includes(p));
}

/** Picks a banter for a map arrival, if any is eligible, to start after a few seconds of free walking. */
export function banterOnArrive(mapId: string) {
  stopBanter();
  B.pending = null;
  const ok = BANTER.filter((b) => eligible(b, mapId));
  if (!ok.length) return;
  const placed = ok.filter((b) => b.maps);
  const pool = placed.length ? placed : ok;
  const b = pool[Math.floor(Math.random() * pool.length)];
  if (Math.random() > (b.chance ?? (b.maps ? 1 : 0.4))) return;
  B.pending = { b, wait: 4 + Math.random() * 5 };
}

export function stopBanter() {
  const p = B.playing;
  if (p?.actor) { const a = findActor(p.actor); if (a) a.barkLine = undefined; }
  B.playing = null;
}

/** Speakers must be close to the leader, so the lines appear on screen together. */
function near(id: string): boolean {
  const a = findActor(id), L = F.leader;
  return !!a && !!L && Math.abs(a.tx - L.tx) + Math.abs(a.ty - L.ty) <= 5;
}

function heroText(s: string): string {
  return s.replace(/\{name\}/g, G.heroName).replace(/\{port\}/g, G.port.name);
}

function showLine() {
  const p = B.playing!;
  const L = p.lines[p.i];
  const id = L.who === 'PORT' ? 'hero' : L.who.toLowerCase();
  const a = findActor(id);
  if (p.actor) { const old = findActor(p.actor); if (old) old.barkLine = undefined; }
  const text = heroText(L.text);
  p.t = Math.max(2.4, 1.4 + text.length * 0.06);
  p.actor = a ? id : undefined;
  if (!a) return;
  const sp = L.who === 'PORT' ? PORT_SPEAKER : speaker(L.who);
  a.barkLine = { text, t: p.t, color: sp?.color ?? C.pale };
}

export function updateBanter(dt: number) {
  if (sceneRunning() || dialogueOpen() || menuOpen() || F.inCombat) {
    if (B.playing) stopBanter();
    return;
  }
  if (F.locked) return;
  if (B.pending && !B.playing) {
    B.pending.wait -= dt;
    if (B.pending.wait > 0) return;
    const b = B.pending.b;
    B.pending = null;
    const sc = SCENES.get(b.scene)!;
    const lines = sc.lines.flatMap((l) => (l.k === 'say' ? [{ who: l.who, text: l.text }] : []));
    if (!lines.length || !b.party.every((p) => G.party.includes(p))) return;
    if (!b.party.every(near)) { B.pending = { b, wait: 1.5 }; return; }
    G.flags['banter_' + b.scene] = 1;
    B.playing = { b, lines, i: 0, t: 0 };
    showLine();
    return;
  }
  const p = B.playing;
  if (!p) return;
  p.t -= dt;
  if (p.t > -0.35) return;
  p.i++;
  if (p.i >= p.lines.length) { stopBanter(); return; }
  showLine();
}

/** For tests: starts a banter scene now. */
export function playBanter(scene: string) {
  const b = BANTER.find((x) => x.scene === scene);
  if (b) B.pending = { b, wait: 0 };
}
