export class Rng {
  private s: number;
  constructor(seed = 1) {
    this.s = (seed >>> 0) || 1;
  }
  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(a: number, b: number): number {
    return a + (b - a) * this.next();
  }
  int(n: number): number {
    return Math.floor(this.next() * n);
  }
  chance(p: number): boolean {
    return this.next() < p;
  }
  pick<T>(a: readonly T[]): T {
    return a[this.int(a.length)];
  }
  weighted<T>(a: readonly T[], w: (t: T) => number): T {
    let tot = 0;
    for (const x of a) tot += w(x);
    let r = this.next() * tot;
    for (const x of a) {
      r -= w(x);
      if (r <= 0) return x;
    }
    return a[a.length - 1];
  }
  get state(): number {
    return this.s;
  }
  set state(v: number) {
    this.s = v;
  }
}

export function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
