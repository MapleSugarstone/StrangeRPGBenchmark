/**
 * Builds a normal map from a sprite's shape: pixels deep inside face the viewer, pixels near the
 * silhouette lean outward, and darker palette slots sit a little lower.
 */
export function normalsOf(idx: Uint8Array, w: number, h: number, depth = 3): Int8Array {
  const dist = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) dist[i] = idx[i] ? depth : 0;
  for (let pass = 0; pass < depth; pass++) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (!idx[i]) continue;
        let m = depth;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const xx = x + dx, yy = y + dy;
          const v = xx < 0 || yy < 0 || xx >= w || yy >= h ? 0 : dist[yy * w + xx];
          if (v + 1 < m) m = v + 1;
        }
        dist[i] = m;
      }
    }
  }
  const hgt = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) hgt[i] = idx[i] ? dist[i] + (idx[i] === 1 ? -0.6 : idx[i] === 3 ? 0.4 : 0) : 0;
  const n = new Int8Array(w * h * 2);
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : hgt[y * w + x]);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!idx[i]) continue;
      let gx = (at(x - 1, y) - at(x + 1, y)) * 0.6;
      let gy = (at(x, y - 1) - at(x, y + 1)) * 0.6;
      const len = Math.sqrt(gx * gx + gy * gy + 1);
      gx /= len; gy /= len;
      n[i * 2] = Math.round(gx * 100);
      n[i * 2 + 1] = Math.round(gy * 100);
      if (n[i * 2] === 0 && n[i * 2 + 1] === 0) n[i * 2 + 1] = -1;
    }
  }
  return n;
}
