// World effects after the composite: wet reflections, rain, and splashes. And steam before it.
import { H, W, alb, buf, emi, flo, ibuf } from '../engine/screen';
import { DOWN, PX, C } from '../engine/palette';
import { ditherAt, lightTint } from '../engine/light';
import { WORLD } from './world';

const REACH = [0, 0, 5, 12, 20];
const DENSITY = [0, 0, 0.45, 0.85, 0.9];

/**
 * Mirrors standing things into wet floor below them. Each column scans down, remembers where the last
 * standing pixel ended, and copies the mirrored pixel one ramp step darker with a small ripple.
 */
export function reflect(t: number, y0 = 0, y1 = H) {
  for (let x = 0; x < W; x++) {
    let base = -1;
    for (let y = y0; y < y1; y++) {
      const i = y * W + x;
      const f = flo[i];
      if (f === 0) { base = y + 1; continue; }
      if (f < 2 || base < 0) continue;
      const d = y - base;
      if (d > REACH[f]) continue;
      const wob = f === 4 ? Math.round(Math.sin(y * 0.9 + t * 3.1) * 1.2) : f === 3 ? Math.round(Math.sin(y * 1.3 + t * 2.3) * 0.6) : 0;
      const sy = base - 1 - d;
      const sx = x + wob;
      if (sy < 0 || sx < 0 || sx >= W) continue;
      const si = sy * W + sx;
      if (flo[si] !== 0) continue;
      const src = ibuf[si];
      if (src === 0) continue;
      const glow = emi[si] === 1;
      if (f === 2 && !glow) continue;
      if (f === 4 && (y & 1) && !glow) continue;
      const fall = 1 - d / (REACH[f] + 1);
      if (ditherAt(x, y) > DENSITY[f] * (glow ? 1 : 0.6) * (0.35 + fall * 0.65)) continue;
      let c = DOWN[src];
      if (!glow) c = DOWN[c];
      if (c === 0) continue;
      ibuf[i] = c;
      buf[i] = PX[c];
    }
  }
}

/** Spawns and draws rain. Drops live in world pixels, take the color of the light they fall through, and splash. */
export function rain(dt: number, amount: number, camX: number, camY: number, wind = -0.33) {
  const want = Math.round(70 * amount);
  const drops = WORLD.drops;
  while (drops.length < want) {
    drops.push({ x: camX + Math.random() * (W + 40), y: camY - Math.random() * H, land: camY + Math.random() * H, splash: 0, layer: Math.random() < 0.45 ? 0 : 1 });
  }
  if (drops.length > want) drops.length = want;
  for (const d of drops) {
    if (d.splash > 0) {
      d.splash -= dt;
      if (d.splash <= 0) {
        d.x = camX + Math.random() * (W + 40);
        d.y = camY - 8 - Math.random() * 30;
        d.land = camY + Math.random() * H;
      }
      continue;
    }
    const v = d.layer ? 260 : 170;
    d.y += v * dt;
    d.x += v * dt * wind;
    if (d.y >= d.land) { d.splash = 0.09; d.y = d.land; }
    if (d.x < camX - 40 || d.x > camX + W + 60 || d.y > camY + H + 10) {
      d.x = camX + Math.random() * (W + 40);
      d.y = camY - 8;
      d.land = camY + Math.random() * H;
    }
  }
  for (const d of drops) {
    const sx = Math.round(d.x - camX), sy = Math.round(d.y - camY);
    if (d.splash > 0) {
      const big = d.splash < 0.05;
      splashPx(sx, sy, big ? 0 : 1);
      if (big) { splashPx(sx - 1, sy, 1); splashPx(sx + 1, sy, 1); }
      continue;
    }
    const len = d.layer ? 4 : 2;
    for (let k = 0; k < len; k++) {
      const x = sx - Math.round(k * wind), y = sy - k;
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const i = y * W + x;
      const c = lightTint(i, d.layer ? 0.95 : 0.7, 0.42);
      if (c < 0 || c === 0) continue;
      ibuf[i] = c;
      buf[i] = PX[c];
    }
  }
}

function splashPx(x: number, y: number, dim: number) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = y * W + x;
  if (flo[i] === 0) return;
  const c = lightTint(i, dim ? 0.7 : 1, 0.4);
  if (c <= 0) return;
  ibuf[i] = c;
  buf[i] = PX[c];
}

/** Emits steam from vents and stalls and draws it into the world layer, where light colors it. */
export function steam(dt: number, sources: [number, number][], camX: number, camY: number) {
  const s = WORLD.steam;
  for (const [x, y] of sources) {
    if (Math.random() < dt * 9) s.push({ x: x + Math.random() * 6 - 3, y, age: 0, life: 1.4 + Math.random() * 1.2, seed: Math.random() * 10 });
  }
  for (let i = s.length - 1; i >= 0; i--) {
    const p = s[i];
    p.age += dt;
    p.y -= dt * 11;
    if (p.age >= p.life) s.splice(i, 1);
  }
  for (const p of s) {
    const k = p.age / p.life;
    const r = 1 + Math.floor(k * 3);
    const cx = Math.round(p.x + Math.sin(p.age * 2 + p.seed) * 2 - camX), cy = Math.round(p.y - camY);
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy > r * r) continue;
      const x = cx + dx, y = cy + dy;
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      if (ditherAt(x, y) > 0.7 * (1 - k)) continue;
      const i = y * W + x;
      if (emi[i] === 2) continue;
      alb[i] = k < 0.4 ? C.pale : C.gray;
      emi[i] = 0;
      flo[i] = 0;
    }
  }
}
