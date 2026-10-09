// Waits for the user to press "Send to agent" on the review page (review/ready.json newer than the last one handled).
// Prints READY with the time and the user's note, then exits 0. Prints WAITING and exits 3 after the time limit.
// Usage: node scripts/review-wait.mjs [minutes, default 9]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const review = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'review');
const readyFile = path.join(review, 'ready.json'), seenFile = path.join(review, 'ready-seen.json');
const read = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };
const limit = Date.now() + Number(process.argv[2] || 9) * 60000;

function check() {
  const ready = read(readyFile), seen = read(seenFile);
  if (ready && (!seen || ready.at > seen.at)) {
    fs.writeFileSync(seenFile, JSON.stringify({ at: ready.at }));
    console.log(`READY ${ready.at}`);
    if (ready.note) console.log(`NOTE ${ready.note}`);
    process.exit(0);
  }
  if (Date.now() > limit) { console.log('WAITING'); process.exit(3); }
  setTimeout(check, 3000);
}
check();
