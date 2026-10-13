// A competent scripted player, shared by the balance simulator and the in-browser auto-player.
import {
  pilgrimActions, moveOptions, targetsFor, vornActions, vornTargets, liveFoes, adjacent, total, overloaded, faded, outermost, reachable,
  type Battle, type Foe, type MoveOpt, type Act, type VornAct, type LbAct,
} from './engine';
import { type ActionId, type Dish, type Emotion, type Layer, reaction } from './model';

function ok(b: Battle, id: ActionId): boolean { return !!pilgrimActions(b).find(a => a.id === id && a.ok); }

function pickTarget(b: Battle, id: ActionId): Foe | null {
  const ts = targetsFor(b, id);
  if (!ts.length) return null;
  return ts.reduce((a, c) => (total(c) < total(a) ? c : a));
}

/** The first unbroken lock on a wind-up that an action this turn can break, as the action to take. */
function lockBreaker(b: Battle): Act | null {
  for (const f of liveFoes(b)) {
    const w = f.windup;
    if (!w) continue;
    for (const l of w.locks.filter(x => !w.broken.includes(x))) {
      const tries: [ActionId, (l: Layer) => boolean][] = [
        ['strip', x => x === 'shell'], ['extract_memory', x => x === 'memory'], ['savor', x => x === 'memory'],
        ['extract_emotion', x => x === 'emotion'], ['extract_name', x => x === 'name'], ['insight', x => x === 'name'],
      ];
      for (const [id, fits] of tries) if (fits(l) && ok(b, id) && targetsFor(b, id).includes(f)) return { id, target: f.uid };
      if (l === 'emotion' && ok(b, 'absorb')) { const i = b.p.hand.findIndex(c => c.layer === 'emotion'); if (i >= 0) return { id: 'absorb', concept: i, target: f.uid, push: true }; }
    }
  }
  return null;
}

/** A pushed essence that does real work: a memory that sends a small Memory-Struck enemy home, or an emotion that overwhelms. */
function goodPush(b: Battle): Act | null {
  if (!ok(b, 'absorb')) return null;
  const live = liveFoes(b);
  const mem = b.p.hand.findIndex(c => c.layer === 'memory');
  const lost = live.find(f => f.category === 'memory' && !f.def.boss && !f.def.up && !f.def.peaceful);
  if (mem >= 0 && lost && b.p.f > b.p.fmax * 0.3) return { id: 'absorb', concept: mem, target: lost.uid, push: true };
  for (let i = 0; i < b.p.hand.length; i++) {
    const c = b.p.hand[i];
    if (c.layer !== 'emotion' || !c.emotion) continue;
    const t = live.find(f => f.hp.emotion > 0 && f.def.emotion && reaction(c.emotion as Emotion, f.def.emotion as Emotion) === 'overwhelm');
    if (t) return { id: 'absorb', concept: i, target: t.uid, push: true };
  }
  return null;
}

/** Where to move before acting, if anywhere. */
export function pilgrimMove(b: Battle): MoveOpt | null {
  const p = b.p;
  const live = liveFoes(b);
  const ground = live.some(f => f.windup && f.windup.move.kind === 'ground' && f.windup.broken.length < f.windup.locks.length);
  if (ground && !lockBreaker(b)) { const fl = moveOptions(b).find(m => m.kind === 'float' && m.to === p.cell); if (fl) return fl; }
  if (!live.length || live.some(f => adjacent(b, f))) return null;
  const nearest = live.reduce((a, c) => (Math.abs(c.cell - p.cell) < Math.abs(a.cell - p.cell) ? c : a));
  const want = (m: { to: number }) => Math.abs(nearest.cell - m.to);
  const best = moveOptions(b).filter(m => m.kind === 'walk' || m.kind === 'slide').sort((a, c) => want(a) - want(c))[0];
  return best && want(best) < Math.abs(nearest.cell - p.cell) ? best : null;
}

/** The action to take after moving. */
export function pilgrimAct(b: Battle): Act {
  const p = b.p;
  const live = liveFoes(b);
  const fm = p.fmax;
  const memIdx = p.hand.findIndex(c => c.layer === 'memory');
  if (p.f < fm * 0.35 && memIdx >= 0 && ok(b, 'absorb')) return { id: 'absorb', concept: memIdx };
  const emoIdx = p.hand.findIndex(c => c.layer === 'emotion');
  const emo = emoIdx >= 0 ? p.hand[emoIdx].emotion as Emotion | undefined : undefined;
  const feeds = emo && live.some(f => f.hp.emotion > 0 && f.def.emotion && reaction(emo, f.def.emotion as Emotion) === 'feed');
  if (!p.buff && emoIdx >= 0 && !feeds && ok(b, 'absorb') && p.f > fm * 0.3) return { id: 'absorb', concept: emoIdx };
  const boss = live.find(f => f.def.boss);
  const gentle = live.find(f => f.def.peaceful && !f.def.boss && adjacent(b, f));
  if (gentle && ok(b, 'handshake')) return { id: 'handshake', target: gentle.uid };
  const lk = lockBreaker(b);
  if (lk) return lk;
  const push = goodPush(b);
  if (push) return push;
  if (ok(b, 'unmake')) {
    const t = pickTarget(b, 'unmake');
    if (t && (t.def.boss || total(t) > 120 || overloaded(b))) return { id: 'unmake', target: t.uid };
  }
  if (overloaded(b) && p.hand.length >= 2 && ok(b, 'weave')) return { id: 'weave', concepts: [0, 1], target: (boss || live[0])?.uid };
  if (ok(b, 'insight') && boss && !boss.insight) return { id: 'insight', target: boss.uid };
  let best: { id: ActionId; t: Foe; score: number } | null = null;
  for (const t of live.filter(f => adjacent(b, f))) {
    const weak = t.category === 'memory' ? 'memory' : t.category === 'emotion' ? 'emotion' : t.category === 'shell' ? 'shell' : null;
    const cands: [ActionId, number][] = [['strip', outermost(t) === 'shell' && t.category === 'shell' ? 2 : 1]];
    for (const [id, l] of [['extract_memory', 'memory'], ['extract_emotion', 'emotion'], ['extract_name', 'name']] as [ActionId, 'memory' | 'emotion' | 'name'][]) {
      if (ok(b, id) && reachable(t, l)) cands.push([id, 1.25 * (weak === l ? 2 : 1) * (t.shadow ? 1.25 : 1)]);
    }
    for (const [id, sc] of cands) {
      if (!ok(b, id)) continue;
      const s = (sc / Math.max(1, total(t))) * 1000;
      if (!best || s > best.score) best = { id, t, score: s };
    }
  }
  if (best) return { id: best.id, target: best.t.uid };
  if (ok(b, 'savor')) { const t = pickTarget(b, 'savor'); if (t) return { id: 'savor', target: t.uid }; }
  if (faded(b) && ok(b, 'savor')) { const t = pickTarget(b, 'savor'); if (t) return { id: 'savor', target: t.uid }; }
  return { id: 'hold' };
}

export function vornChoice(b: Battle): { id: VornAct; target?: number } {
  const v = b.vorn!;
  if (b.p.f < b.p.fmax * 0.4) return { id: 'guard' };
  const acts = vornActions(b);
  if (acts.find(a => a.id === 'stand' && a.ok) && v.hp > v.max * 0.5 && liveFoes(b).some(f => f.def.boss)) return { id: 'stand', target: vornTargets(b, 'stand')[0]?.uid };
  if (acts.find(a => a.id === 'cleave' && a.ok)) {
    const ts = vornTargets(b, 'cleave');
    const wind = ts.find(f => f.windup && f.windup.locks.includes('shell') && !f.windup.broken.includes('shell'));
    return { id: 'cleave', target: (wind || ts[0]).uid };
  }
  return { id: 'guard' };
}

export function lbChoice(b: Battle): { id: LbAct; dish?: Dish; target?: number } {
  const l = b.lb!;
  const p = b.p;
  const wind = liveFoes(b).find(f => f.windup && f.windup.locks.includes('emotion') && !f.windup.broken.includes('emotion'));
  if (wind && p.f > p.fmax * 0.3) return { id: 'glow', target: wind.uid };
  if ((p.f < p.fmax * 0.35 || p.f > p.fmax * 0.85) && l.pantry.ravioli > 0) return { id: 'cook', dish: 'ravioli' };
  if (p.f < p.fmax * 0.25 && l.pantry.cake > 0) return { id: 'cook', dish: 'cake' };
  if (b.vorn && b.vorn.hp < b.vorn.max * 0.4 && l.pantry.quiche > 0) return { id: 'cook', dish: 'quiche' };
  if (p.forgotten.size > 1 && l.pantry.toast > 0) return { id: 'cook', dish: 'toast' };
  return { id: 'cheer' };
}
