import type { SfxPart } from '../core/audio';

const BOOT: SfxPart[] = [
  { wave: 'pulse', duty: 1, f: 784, s: 0.06, d: 0.12, vol: 0.12 },
  { at: 0.11, wave: 'pulse', duty: 0, f: 1568, s: 0.1, d: 0.25, vol: 0.11, vib: [6, 0.1] },
  { at: 0.11, wave: 'tri', f: 784, a: 0.02, s: 0.2, d: 0.65, vol: 0.12, vib: [5, 0.08] },
  { at: 0.12, wave: 'sine', f: 3136, a: 0.01, s: 0.05, d: 0.5, vol: 0.025 },
];

function warp(parts: SfxPart[], time: number, semis: number): SfxPart[] {
  return parts.flatMap((p) => {
    const q: SfxPart = {
      ...p, at: (p.at ?? 0) * time, a: (p.a ?? 0.003) * time, s: (p.s ?? 0.05) * time, d: (p.d ?? 0.05) * time,
      f: p.f * Math.pow(2, semis / 12), slide: (p.slide ?? 0) / time - 1.2, vib: [3, 0.3],
    };
    return [q, { ...q, f: q.f * Math.pow(2, 0.4 / 12), vol: (q.vol ?? 0.1) * 0.6 }];
  });
}

const CASCADE: [number, number][] = [[0.04, 2], [0.08, 4], [0.12, 7], [0.16, 9], [0.2, 12], [0.24, 14], [0.28, 16], [0.32, 19], [0.36, 24]];
const DISCOVER: [number, number][] = [[0.1, 7], [0.2, 11], [0.3, 18]];

export const SFX: Record<string, SfxPart | SfxPart[]> = {
  move: { wave: 'pulse', duty: 1, f: 660, s: 0.02, d: 0.02, vol: 0.07 },
  blip: { wave: 'pulse', duty: 2, f: 880, s: 0.025, d: 0.02, vol: 0.09 },
  text: { wave: 'pulse', duty: 0, f: 1400, s: 0.008, d: 0.008, vol: 0.035 },
  ok: { wave: 'pulse', duty: 1, f: 660, arp: [[0.05, 7]], s: 0.08, d: 0.04, vol: 0.1 },
  back: { wave: 'pulse', duty: 1, f: 520, arp: [[0.05, -8]], s: 0.08, d: 0.04, vol: 0.09 },
  buzz: { wave: 'pulse', duty: 0, f: 120, slide: -6, s: 0.1, d: 0.05, lp: 2400, vol: 0.12 },
  wrong: { wave: 'pulse', duty: 2, f: 300, arp: [[0.1, -3]], s: 0.2, d: 0.1, vol: 0.1 },
  hit: [
    { wave: 'noise', f: 3000, slide: -40, s: 0.02, d: 0.06, vol: 0.25 },
    { wave: 'pulse', duty: 2, f: 180, slide: -60, s: 0.02, d: 0.06, vol: 0.12 },
  ],
  crit: [
    { wave: 'noise', f: 5000, slide: -30, s: 0.03, d: 0.08, punch: 0.5, vol: 0.28 },
    { wave: 'pulse', duty: 1, f: 420, slide: -90, s: 0.05, d: 0.11, punch: 0.4, vol: 0.15 },
  ],
  weak: [
    { wave: 'noise', f: 2000, s: 0.02, d: 0.04, vol: 0.24 },
    { at: 0.04, wave: 'pulse', duty: 1, f: 600, slide: 40, s: 0.06, d: 0.06, vol: 0.14 },
  ],
  miss: { wave: 'tri', f: 1200, slide: -200, s: 0.03, d: 0.06, vol: 0.1 },
  heal: { wave: 'tri', f: 523, arp: [[0.05, 4], [0.1, 7], [0.15, 12]], s: 0.18, d: 0.08, vib: [7, 0.1], vol: 0.17 },
  buff: { wave: 'pulse', duty: 1, f: 392, arp: [[0.06, 5], [0.12, 9]], s: 0.15, d: 0.06, vol: 0.09 },
  debuff: { wave: 'pulse', duty: 1, f: 659, arp: [[0.06, -4], [0.12, -9]], s: 0.15, d: 0.06, vol: 0.09 },
  ko: { wave: 'pulse', duty: 2, f: 400, slide: -20, dslide: -160, s: 0.15, d: 0.25, vib: [8, 0.3], vol: 0.12 },
  ring: { wave: 'pulse', duty: 1, f: 1318, arp: [[0.035, 3]], rep: 0.07, s: 0.4, d: 0.02, vol: 0.07 },
  answer: { wave: 'tri', f: 784, arp: [[0.08, 4], [0.16, 7], [0.24, 12]], s: 0.3, d: 0.15, vol: 0.18 },
  step: { wave: 'noise', f: 900, s: 0.004, d: 0.012, lp: 2500, vol: 0.05 },
  door: { wave: 'pulse', duty: 1, f: 200, slide: 40, arp: [[0.08, 7]], s: 0.12, d: 0.04, vol: 0.09 },
  level: { wave: 'pulse', duty: 1, f: 523, arp: [[0.07, 4], [0.14, 7], [0.21, 12], [0.28, 7], [0.35, 12]], s: 0.42, d: 0.08, vol: 0.11 },
  item: { wave: 'tri', f: 880, arp: [[0.08, 5]], s: 0.16, d: 0.06, vol: 0.16 },
  dig: [
    { wave: 'noise', f: 800, s: 0.02, d: 0.04, lp: 1500, vol: 0.22 },
    { at: 0.1, wave: 'noise', f: 600, s: 0.02, d: 0.04, lp: 1500, vol: 0.22 },
  ],
  listen: [
    { wave: 'sine', f: 220, slide: 30, a: 0.05, s: 0.2, d: 0.15, vib: [5, 0.2], vol: 0.13 },
    { at: 0.2, wave: 'sine', f: 330, slide: 17, a: 0.05, s: 0.2, d: 0.15, vol: 0.09 },
  ],
  encounter: { wave: 'pulse', duty: 1, f: 1046, arp: [[0.05, -5], [0.1, 0], [0.15, -5], [0.2, 4]], s: 0.24, d: 0.03, vol: 0.11 },
  save: { wave: 'tri', f: 659, arp: [[0.1, 3], [0.2, 7]], s: 0.3, d: 0.1, vol: 0.16 },
  rewind: { wave: 'pulse', duty: 0, f: 1600, slide: -60, vib: [30, 1.5], s: 0.24, d: 0.03, vol: 0.07 },
  link: [
    { wave: 'pulse', duty: 1, f: 523, slide: 60, s: 0.15, d: 0.05, vol: 0.08 },
    { wave: 'pulse', duty: 0, f: 659, slide: 60, s: 0.15, d: 0.05, vol: 0.07 },
  ],
  shake: [
    { wave: 'noise', f: 300, slide: -10, s: 0.15, d: 0.15, lp: 600, vol: 0.2 },
    { wave: 'tri', f: 90, slide: -12, s: 0.15, d: 0.15, vol: 0.14 },
  ],
  clean: { wave: 'pulse', duty: 1, f: 1760, arp: [[0.03, 7]], s: 0.07, d: 0.04, vol: 0.09 },
  boot: BOOT,
  bootwrong: warp(BOOT, 1.7, -1),
  deadair: [
    { wave: 'noise', f: 2400, q: 0.5, s: 0.22, d: 0.1, vib: [17, 10], lp: 5000, vol: 0.12 },
    { at: 0.26, wave: 'sine', f: 880, a: 0.03, s: 0.5, d: 0.6, vol: 0.13 },
  ],
  coin: { wave: 'pulse', duty: 1, f: 1318, arp: [[0.05, 7]], s: 0.1, d: 0.16, vol: 0.09 },
  gold: [
    { wave: 'pulse', duty: 1, f: 1046, arp: CASCADE, s: 0.4, d: 0.25, vib: [9, 0.12], vol: 0.08 },
    { at: 0.03, wave: 'tri', f: 2093, arp: CASCADE, s: 0.4, d: 0.25, vol: 0.05 },
    { at: 0.42, wave: 'sine', f: 4186, a: 0.005, s: 0.02, d: 0.6, vib: [11, 0.2], vol: 0.03 },
  ],
  secret: [
    { wave: 'pulse', duty: 1, f: 659, arp: DISCOVER, s: 0.42, d: 0.3, vib: [6, 0.12], vol: 0.1 },
    { at: 0.1, wave: 'pulse', duty: 0, f: 659, arp: DISCOVER, s: 0.42, d: 0.3, vol: 0.04 },
  ],
  static: { wave: 'noise', f: 3000, q: 0.6, s: 0.2, d: 0.09, vib: [23, 8], lp: 6000, vol: 0.1 },
  dial: [
    { wave: 'sine', f: 350, s: 0.12, d: 0.03, vol: 0.08 },
    { wave: 'sine', f: 440, s: 0.12, d: 0.03, vol: 0.08 },
  ],
  hangup: [
    { wave: 'noise', f: 1200, s: 0.005, d: 0.02, vol: 0.15 },
    { at: 0.08, wave: 'sine', f: 480, s: 0.09, d: 0.02, vol: 0.06 },
    { at: 0.08, wave: 'sine', f: 620, s: 0.09, d: 0.02, vol: 0.06 },
    { at: 0.26, wave: 'sine', f: 480, s: 0.09, d: 0.02, vol: 0.06 },
    { at: 0.26, wave: 'sine', f: 620, s: 0.09, d: 0.02, vol: 0.06 },
  ],
};
