// Connects the field to scripts: senses, pickups, doors, drifters, and fading away.
import { sfx } from '../engine/audio';
import { F, entInFront, setFadeHook, setDoorHook, setPickupHook, setLockedHook, showGoal, DX, DY, entVisible, tileAt } from './field';
import { run } from './script';
import { say, warp, drifterFight, fadeAway, giveConcept, giveShellKind } from './api';
import { S, fmax } from './state';
import { toast } from './ui';
import { UI } from './palette';
import type { SenseId } from '../battle/model';
import type { Script } from './types';
import { SHELLS } from '../battle/enemies';

const DEFAULT: Record<SenseId, string> = {
  sight: '', touch: 'You reach out. Nothing there reaches back.', hearing: 'You hear the hum under everything.',
  taste: 'It tastes of brass and dust.', smell: '', thought: 'You understand it completely. It is not interesting.',
};

function onSense(s: SenseId): void {
  sfx(s === 'sight' ? 'true_sight' : s === 'touch' ? 'handshake' : s === 'hearing' ? 'echo' : s === 'taste' ? 'savor' : s === 'smell' ? 'scent' : 'insight');
  if (s === 'sight') {
    F.trueSight = !F.trueSight;
    toast(F.trueSight ? 'True Sight. You see it as it truly is.' : 'Your sight settles.', F.trueSight ? UI.violet : UI.dim);
    return;
  }
  if (s === 'smell') {
    showGoal();
    for (const e of F.ents) if (entVisible(e) && e.def.sense?.smell && Math.abs(e.x - F.p.x) + Math.abs(e.y - F.p.y) <= 6) { run(e.def.sense.smell); break; }
    return;
  }
  if (s === 'hearing') {
    F.hearT = 360;
    const near = F.ents.filter(e => entVisible(e) && e.def.sense?.hearing && Math.abs(e.x - F.p.x) + Math.abs(e.y - F.p.y) <= 5);
    if (near.length) { run(near[0].def.sense!.hearing!); return; }
    toast(DEFAULT.hearing, UI.dim);
    return;
  }
  const e = entInFront();
  const hook = e?.def.sense?.[s];
  if (hook) { run(hook); return; }
  if (s === 'thought' && e?.def.truth) { run(function* (): Script { yield* say(null, e.def.truth!); }); return; }
  if (s === 'touch' && e?.def.mood) { toast(`You feel ${e.def.mood} in it.`, UI.paper); return; }
  if (s === 'taste') {
    const fx = F.p.x + DX[F.p.dir], fy = F.p.y + DY[F.p.dir];
    const t = tileAt(fx, fy);
    toast(t?.water ? 'It tastes like water that remembers being rain.' : DEFAULT.taste, UI.dim);
    return;
  }
  toast(DEFAULT[s], UI.dim);
}

export function installHooks(): void {
  F.onSense = onSense;
  F.onBattle = (group, d) => run(() => drifterFight(group, d.id));
  setFadeHook(() => run(fadeAway));
  setLockedHook(msg => run(function* (): Script { yield* say(null, msg); }));
  setDoorHook(d => run(() => warp(d.map, d.x, d.y, d.dir ?? F.p.dir)));
  setPickupHook(pk => run(function* (): Script {
    if (pk.kind === 'shell') { giveShellKind(pk.id); if (pk.text) yield* say(null, pk.text); else yield* say(null, `${SHELLS[pk.id]?.name}. ${SHELLS[pk.id]?.text}`); return; }
    if (pk.kind === 'book') {
      yield* giveConcept({ layer: 'memory', label: pk.label, from: 'book' }, pk.text);
      return;
    }
    if (pk.kind === 'name') { S.names[pk.label] = (S.names[pk.label] || 0) + 1; S.totals.name++; sfx('name_get'); toast(`Name: ${pk.label}`, UI.gold); if (pk.text) yield* say(null, pk.text); return; }
    yield* giveConcept({ layer: pk.kind as 'memory' | 'emotion', label: pk.label, from: 'field', emotion: pk.kind === 'emotion' ? pk.id as never : undefined }, pk.text);
    if (S.f > fmax() * 0.8) toast('You are too full of things.', UI.red);
  }));
}
