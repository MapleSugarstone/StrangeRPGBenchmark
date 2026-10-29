// Screen effects shared by scenes and modes: shake, fades, and flashes.
import { until } from './sched';

export const FX = {
  shake: 0,
  shakePow: 0,
  fade: 0,
  fadeTarget: 0,
  fadeSpeed: 2.5,
};

export function shake(strength = 1, seconds = 0.4) { FX.shake = seconds; FX.shakePow = strength; }

export function fadeTo(target: number, seconds = 0.4): Promise<void> {
  FX.fadeTarget = target;
  FX.fadeSpeed = 1 / Math.max(0.05, seconds);
  return until(() => Math.abs(FX.fade - target) < 0.001);
}

export function updateFx(dt: number) {
  if (FX.shake > 0) FX.shake -= dt;
  if (FX.fade < FX.fadeTarget) FX.fade = Math.min(FX.fadeTarget, FX.fade + dt * FX.fadeSpeed);
  else if (FX.fade > FX.fadeTarget) FX.fade = Math.max(FX.fadeTarget, FX.fade - dt * FX.fadeSpeed);
}

export function shakeOffset(): [number, number] {
  if (FX.shake <= 0) return [0, 0];
  const p = Math.round(FX.shakePow);
  return [Math.round((Math.random() * 2 - 1) * p), Math.round((Math.random() * 2 - 1) * p)];
}
