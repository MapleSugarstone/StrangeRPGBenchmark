import { writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { getSprite } from "../engine/sprites";
import { PALETTE } from "../engine/palette";
import { MEMBERS } from "../game/data/members";

/** Writes the hero sprite as a PNG for the benchmark's cartridge menu. `node dist/art.js out.png` */
const out = process.argv[2] ?? "plumb-hero.png";
const sp = MEMBERS.fathom.sprite;
const cells = getSprite(sp.kind, sp.seed, sp.variant);
const hex = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const cols: Record<number, number[]> = { 1: hex(PALETTE.black), 2: hex(PALETTE[sp.a]), 3: hex(PALETTE[sp.b]) };
const W = 8, H = 8;
const raw = Buffer.alloc((W * 4 + 1) * H);
for (let y = 0; y < H; y++) {
  raw[y * (W * 4 + 1)] = 0;
  for (let x = 0; x < W; x++) {
    const v = cells[y * 8 + x];
    const o = y * (W * 4 + 1) + 1 + x * 4;
    if (v === 0) { raw[o] = 0; raw[o + 1] = 0; raw[o + 2] = 0; raw[o + 3] = 0; }
    else { const [r, g, b] = cols[v]; raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = 255; }
  }
}
const crcTable = new Int32Array(256);
for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcTable[n] = c; }
const crc = (buf: Buffer) => { let c = -1; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ -1) >>> 0; };
const chunk = (type: string, data: Buffer) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
  return Buffer.concat([len, td, c]);
};
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
writeFileSync(out, png);
console.log(`wrote ${out}`);
