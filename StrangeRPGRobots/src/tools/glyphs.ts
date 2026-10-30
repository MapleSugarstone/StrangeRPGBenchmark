// Writes naturalize/glyph-widths.json: the pixel width of each printable character in the game font, so tools
// outside the game can tell whether a rewritten label still fits.
import fs from 'node:fs';
import path from 'node:path';
import { textWidth } from '../engine/font';

const widths: Record<string, number> = {};
for (let c = 32; c < 127; c++) widths[String.fromCharCode(c)] = textWidth(String.fromCharCode(c));
const out = path.join(process.cwd(), 'naturalize', 'glyph-widths.json');
fs.writeFileSync(out, JSON.stringify(widths));
console.log(`Wrote ${Object.keys(widths).length} widths to ${out}`);
