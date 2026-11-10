// The desk orchestra. Every instrument is an object from a surveyor's desk, synthesized once into a sample.
// The functions are pure so the music check tool can run them in Node.
export const RATE = 32000;

export interface Sample { data: Float32Array; base: number }

function noiseSource(seed: number): () => number {
  let s = seed | 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) | 0; return (s >>> 8) / 8388608 - 1; };
}

function bandpass(input: Float32Array, freq: number, q: number): Float32Array {
  const w = (2 * Math.PI * freq) / RATE, alpha = Math.sin(w) / (2 * q), cos = Math.cos(w);
  const b0 = alpha, b2 = -alpha, a0 = 1 + alpha, a1 = -2 * cos, a2 = 1 - alpha;
  const out = new Float32Array(input.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < input.length; i++) {
    const x = input[i];
    const y = (b0 * x + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1; x1 = x; y2 = y1; y1 = y;
    out[i] = y;
  }
  return out;
}

function lowpass(input: Float32Array, freq: number): Float32Array {
  const a = 1 - Math.exp((-2 * Math.PI * freq) / RATE);
  const out = new Float32Array(input.length);
  let y = 0;
  for (let i = 0; i < input.length; i++) { y += a * (input[i] - y); out[i] = y; }
  return out;
}

function normalize(d: Float32Array, peak: number): Float32Array {
  let m = 0;
  for (let i = 0; i < d.length; i++) m = Math.max(m, Math.abs(d[i]));
  if (m > 0) for (let i = 0; i < d.length; i++) d[i] *= peak / m;
  const fade = Math.min(400, d.length);
  for (let i = 0; i < fade; i++) d[d.length - 1 - i] *= i / fade;
  return d;
}

/** A ruler held off the desk edge and plucked: clamped-bar partials, a short upward glide, and a rattle against the desk. */
function ruler(): Sample {
  const base = 196, n = Math.floor(RATE * 0.9);
  const d = new Float32Array(n);
  let p1 = 0, p2 = 0, p3 = 0;
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    const glide = 1 - 0.035 * Math.exp(-t / 0.035);
    const f = base * glide;
    p1 += (2 * Math.PI * f) / RATE; p2 += (2 * Math.PI * f * 6.27) / RATE; p3 += (2 * Math.PI * f * 17.5) / RATE;
    const body = Math.sin(p1) * Math.exp(-t / 0.32);
    const rattle = Math.max(0, Math.sin(p1)) ** 2 * 0.5 * Math.exp(-t / 0.09);
    d[i] = body + rattle + Math.sin(p2) * 0.22 * Math.exp(-t / 0.06) + Math.sin(p3) * 0.08 * Math.exp(-t / 0.02);
  }
  return { data: normalize(d, 0.9), base };
}

/** A rubber band: a damped plucked string that starts sharp and sags. */
function band(): Sample {
  const base = 98, n = Math.floor(RATE * 0.7);
  const period = Math.round(RATE / base);
  const rnd = noiseSource(7);
  const line = new Float32Array(period);
  for (let i = 0; i < period; i++) line[i] = rnd();
  const raw = new Float32Array(n);
  let idx = 0, prev = 0;
  for (let i = 0; i < n; i++) {
    const v = line[idx];
    const avg = (v + prev) * 0.5 * 0.992;
    prev = v;
    line[idx] = avg;
    idx = (idx + 1) % period;
    raw[i] = v * Math.exp(-i / RATE / 0.28);
  }
  const d = lowpass(raw, 900);
  return { data: normalize(d, 0.95), base };
}

/** An ink bottle blown across its mouth: a near sine with breath and a slow start. */
function bottle(): Sample {
  const base = 392, n = Math.floor(RATE * 1.3);
  const rnd = noiseSource(11);
  const breath = new Float32Array(n);
  for (let i = 0; i < n; i++) breath[i] = rnd();
  const air = bandpass(breath, base, 9);
  const d = new Float32Array(n);
  let p = 0;
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    const env = Math.min(1, t / 0.07) * Math.exp(-Math.max(0, t - 0.5) / 0.4);
    const f = base * (1 - 0.01 * Math.exp(-t / 0.05)) * (1 + 0.002 * Math.sin(t * 31));
    p += (2 * Math.PI * f) / RATE;
    d[i] = (Math.sin(p) + 0.12 * Math.sin(2 * p) + air[i] * 3.2) * env;
  }
  return { data: normalize(d, 0.8), base };
}

/** An ink bottle tapped with a pencil: glass partials that die fast. */
function glass(): Sample {
  const base = 523.25, n = Math.floor(RATE * 0.9);
  const d = new Float32Array(n);
  const parts: [number, number, number][] = [[1, 1, 0.5], [2.32, 0.45, 0.22], [4.25, 0.25, 0.1], [6.63, 0.12, 0.05]];
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    let v = 0;
    for (const [r, a, tau] of parts) v += Math.sin(2 * Math.PI * base * r * t) * a * Math.exp(-t / tau);
    d[i] = v * Math.min(1, t / 0.002);
  }
  return { data: normalize(d, 0.85), base };
}

/** The desk bell. */
function bell(): Sample {
  const base = 1046.5, n = Math.floor(RATE * 1.8);
  const d = new Float32Array(n);
  const parts: [number, number, number][] = [[1, 1, 1.1], [2.76, 0.5, 0.6], [5.4, 0.3, 0.3], [8.93, 0.15, 0.12]];
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    let v = 0;
    for (const [r, a, tau] of parts) v += Math.sin(2 * Math.PI * base * r * t) * a * Math.exp(-t / tau);
    d[i] = v * Math.min(1, t / 0.001);
  }
  return { data: normalize(d, 0.7), base };
}

/** A pencil tap on the desk. */
function tap(): Sample {
  const n = Math.floor(RATE * 0.07);
  const rnd = noiseSource(3);
  const raw = new Float32Array(n);
  for (let i = 0; i < n; i++) raw[i] = rnd() * Math.exp(-i / RATE / 0.004);
  const a = bandpass(raw, 900, 3), b = bandpass(raw, 2400, 4);
  const d = new Float32Array(n);
  for (let i = 0; i < n; i++) d[i] = a[i] + b[i] * 0.7;
  return { data: normalize(d, 0.9), base: 900 };
}

/** A rubber stamp coming down on paper. */
function stamp(): Sample {
  const n = Math.floor(RATE * 0.18);
  const rnd = noiseSource(5);
  const raw = new Float32Array(n);
  for (let i = 0; i < n; i++) raw[i] = rnd() * Math.exp(-i / RATE / 0.012);
  const slap = lowpass(raw, 1400);
  const d = new Float32Array(n);
  let p = 0;
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    const f = 45 + 60 * Math.exp(-t / 0.03);
    p += (2 * Math.PI * f) / RATE;
    d[i] = Math.sin(p) * Math.exp(-t / 0.06) + slap[i] * 0.8;
  }
  return { data: normalize(d, 0.95), base: 60 };
}

/** A sheet of paper moved across the desk. */
function paper(): Sample {
  const n = Math.floor(RATE * 0.16);
  const rnd = noiseSource(9);
  const raw = new Float32Array(n);
  for (let i = 0; i < n; i++) { const t = i / n; raw[i] = rnd() * Math.sin(Math.PI * t) ** 2; }
  return { data: normalize(bandpass(raw, 3600, 0.9), 0.6), base: 3600 };
}

/** A pen nib dragged over paper. */
function scratch(): Sample {
  const n = Math.floor(RATE * 0.13);
  const rnd = noiseSource(13);
  const raw = new Float32Array(n);
  for (let i = 0; i < n; i++) { const t = i / RATE; raw[i] = rnd() * (Math.sin(2 * Math.PI * 46 * t) > 0 ? 1 : 0.15) * Math.exp(-t / 0.07); }
  return { data: normalize(bandpass(raw, 3000, 1.6), 0.6), base: 3000 };
}

export type InstId = 'ruler' | 'band' | 'bottle' | 'glass' | 'bell' | 'tap' | 'stamp' | 'paper' | 'scratch';

export function buildFont(): Record<InstId, Sample> {
  return { ruler: ruler(), band: band(), bottle: bottle(), glass: glass(), bell: bell(), tap: tap(), stamp: stamp(), paper: paper(), scratch: scratch() };
}
