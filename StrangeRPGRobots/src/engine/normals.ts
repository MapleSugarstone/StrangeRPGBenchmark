/**
 * Builds a normal map from a sprite's shape, treating the silhouette as a raised pillow. A pixel's height is
 * its distance to the nearest clear pixel, flat from `depth` in. A 3 by 3 Sobel slope of that height gives the
 * normal, and edge pixels lean out at about 60 degrees. A thin pixel (a hand, an antenna, a hair tip) has at
 * most one solid neighbor, stays out of the height map, and points straight out from the pixel it joins.
 * Darker palette slots sit a little lower and accents a little higher.
 */
const TILT = 2.2;

export function normalsOf(idx: Uint8Array, w: number, h: number, depth = 4): Int8Array {
  const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && idx[y * w + x] !== 0;
  const thin = new Int8Array(w * h);
  const next = new Int16Array(w * h).fill(-1);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (!idx[i]) continue;
    let n = 0, j = -1;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (solid(x + dx, y + dy)) { n++; j = (y + dy) * w + x + dx; }
    if (n <= 1) { thin[i] = 1; next[i] = j; }
  }
  const dist = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) dist[i] = idx[i] && !thin[i] ? depth : 0;
  for (let pass = 0; pass < depth; pass++) {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!idx[i] || thin[i]) continue;
      let m = depth;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const xx = x + dx, yy = y + dy;
        const v = xx < 0 || yy < 0 || xx >= w || yy >= h ? 0 : dist[yy * w + xx];
        if (v + 1 < m) m = v + 1;
      }
      dist[i] = m;
    }
  }
  const hgt = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) hgt[i] = idx[i] && !thin[i] ? dist[i] + (idx[i] === 1 ? -0.5 : idx[i] === 3 ? 0.35 : 0) : 0;
  const H = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : hgt[y * w + x]);
  const n = new Int8Array(w * h * 2);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (!idx[i]) continue;
    let a: number, b: number, c: number;
    if (thin[i] && next[i] >= 0) {
      a = (x - (next[i] % w)) * 2; b = (y - Math.floor(next[i] / w)) * 2; c = 0.6;
    } else {
      const gx = (H(x + 1, y - 1) + 2 * H(x + 1, y) + H(x + 1, y + 1) - H(x - 1, y - 1) - 2 * H(x - 1, y) - H(x - 1, y + 1)) / 8;
      const gy = (H(x - 1, y + 1) + 2 * H(x, y + 1) + H(x + 1, y + 1) - H(x - 1, y - 1) - 2 * H(x, y - 1) - H(x + 1, y - 1)) / 8;
      a = -TILT * gx; b = -TILT * gy; c = 1;
    }
    const len = Math.hypot(a, b, c);
    n[i * 2] = Math.round((a / len) * 100);
    n[i * 2 + 1] = Math.round((b / len) * 100);
    if (n[i * 2] === 0 && n[i * 2 + 1] === 0) n[i * 2 + 1] = -1;
  }
  return n;
}
