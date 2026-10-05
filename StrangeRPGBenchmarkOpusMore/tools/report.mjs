// Builds reports/report.html from reports/metrics.json. Usage: node tools/report.mjs
import fs from 'node:fs';

const m = JSON.parse(fs.readFileSync('reports/metrics.json', 'utf8'));
const md = fs.readFileSync('reports/balance.md', 'utf8');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const pct = (x) => `${Math.round(x * 100)}%`;
const MECH = { 1: 'Listen', 2: 'Answer', 3: 'Party Line', 4: 'Rewind', 5: 'Masks', 6: 'Silence and twin heads', 7: 'Last Word', 8: 'Call', 9: 'Final answer' };
const BOSSNAME = { want: 'The Want', bigger: 'Bigger', supervisor: 'The Supervisor', bedtime: 'Bedtime', house: 'The House', hush: 'The Hush', linemen: 'Linemen', sincerely: 'Sincerely', deadletter: 'Dead Letter', amen1: 'Amen, first', amen2: 'Amen, second' };

const bosses = m.chapters.flatMap((c) => c.bosses.map((b) => ({ ch: c.n, title: c.title, ...b })));
const totalMin = m.chapters.reduce((s, c) => s + c.minutes, 0);
const casualVals = bosses.filter((b) => b.group !== 'linemen').map((b) => b.v.casual.win);

// Difficulty chart: casual and smart win rate per boss, with the target band.
function diffChart() {
  const W = 720, H = 260, L = 44, R = 12, T = 16, B = 70;
  const n = bosses.length, step = (W - L - R) / n;
  const y = (v) => T + (1 - v) * (H - T - B);
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Win rate per boss for the casual and lookahead players">`;
  s += `<rect x="${L}" y="${y(0.8)}" width="${W - L - R}" height="${y(0.5) - y(0.8)}" class="band"/>`;
  s += `<text x="${W - R - 4}" y="${y(0.8) - 4}" text-anchor="end" class="tick">target band for the casual player</text>`;
  for (const v of [0, 0.25, 0.5, 0.75, 1]) {
    s += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" class="grid"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end" class="tick">${pct(v)}</text>`;
  }
  bosses.forEach((b, i) => {
    const cx = L + step * i + step / 2;
    const c = b.v.casual.win, sm = b.v.smart.win, ma = b.v.mash.win;
    s += `<line x1="${cx}" x2="${cx}" y1="${y(Math.max(c, sm))}" y2="${y(Math.min(c, sm, ma))}" class="stem"/>`;
    s += `<circle cx="${cx}" cy="${y(ma)}" r="3.5" class="dot-mash"><title>Masher ${pct(ma)}</title></circle>`;
    s += `<circle cx="${cx}" cy="${y(sm)}" r="4.5" class="dot-smart"><title>Lookahead ${pct(sm)}</title></circle>`;
    s += `<circle cx="${cx}" cy="${y(c)}" r="6" class="dot-casual"><title>Casual ${pct(c)}</title></circle>`;
    s += `<text x="${cx}" y="${H - B + 18}" text-anchor="middle" class="tick strong">${b.ch}</text>`;
    s += `<text x="${cx}" y="${H - B + 32}" text-anchor="middle" class="tick">${esc((BOSSNAME[b.group] ?? b.group).replace('The ', ''))}</text>`;
  });
  s += `<text x="${L}" y="${H - 8}" class="tick">Chapter and boss</text></svg>`;
  return s;
}

// Fun Index chart: stacked weighted parts per chapter.
function funChart() {
  const parts = ['challenge', 'tension', 'lead', 'variety', 'relevance', 'pacing', 'novelty'];
  const W = 720, H = 250, L = 44, R = 12, T = 12, B = 46;
  const n = m.chapters.length, step = (W - L - R) / n, bw = step * 0.56;
  const y = (v) => T + (1 - v / 100) * (H - T - B);
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Fun Index per chapter, split into its parts">`;
  for (const v of [0, 25, 50, 75, 100]) s += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" class="grid"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end" class="tick">${v}</text>`;
  m.chapters.forEach((c, i) => {
    const x = L + step * i + (step - bw) / 2;
    let acc = 0;
    parts.forEach((p, k) => {
      const v = (c.fun.parts[p] ?? 0) * m.weights[p];
      if (v <= 0) return;
      s += `<rect x="${x}" y="${y(acc + v)}" width="${bw}" height="${y(acc) - y(acc + v)}" class="seg s${k}"><title>${p}: ${v.toFixed(1)} of ${m.weights[p]}</title></rect>`;
      acc += v;
    });
    s += `<text x="${x + bw / 2}" y="${y(acc) - 5}" text-anchor="middle" class="tick strong">${Math.round(c.fun.index)}</text>`;
    s += `<text x="${x + bw / 2}" y="${H - B + 18}" text-anchor="middle" class="tick">Ch ${c.n}</text>`;
  });
  s += `</svg>`;
  const legend = parts.map((p, k) => `<span class="key"><i class="sw s${k}"></i>${p} <em>${m.weights[p]}</em></span>`).join('');
  return s + `<div class="legend">${legend}</div>`;
}

const rows = bosses.map((b) => {
  const v = b.v;
  const lvl = `${b.partyLvl.toFixed(1)} / ${b.bossLvl}`;
  return `<tr><td class="num">${b.ch}</td><td>${esc(BOSSNAME[b.group] ?? b.group)}</td>
    <td class="num">${pct(v.smart.win)}</td><td class="num hl">${pct(v.casual.win)}</td><td class="num">${pct(v.mash.win)}</td><td class="num">${pct(v.random.win)}</td>
    <td class="num">${v.smart.actions.m.toFixed(0)}</td><td class="num">${pct(v.casual.hp.m)}</td><td class="num">${v.casual.leadChanges.m.toFixed(2)}</td>
    <td class="num">${pct(v.casual.comeback + v.casual.nearMiss)}</td><td class="num">${lvl}</td></tr>`;
}).join('');

const mechRows = m.chapters.map((c) => {
  const b = c.bosses[0];
  const d = Math.round(b.dropMech * 100);
  const req = b.required ? '<span class="pill req">required by design</span>' : d >= 5 ? '<span class="pill ok">changes outcomes</span>' : '<span class="pill low">optional</span>';
  return `<tr><td class="num">${c.n}</td><td>${MECH[c.n]}</td><td class="num">${b.required ? 'n/a' : `${d} pts`}</td><td>${req}</td></tr>`;
}).join('');

const chRows = m.chapters.map((c) => `<tr><td class="num">${c.n}</td><td>${esc(c.title)}</td><td class="num">${c.minutes.toFixed(0)}</td><td class="num">${c.fightLen.toFixed(1)}</td><td class="num">${pct(c.fightHpLost)}</td><td class="num">${c.retries}</td><td class="num">${c.noveltyPer10.toFixed(1)}</td></tr>`).join('');

const probs = m.chapters.flatMap((c) => c.problems).filter((p) => !/linemen/.test(p));
const formula = (md.match(/## Fun Index[\s\S]*?(?=\n## )/) ?? [''])[0];
const formulaLines = formula.split('\n').filter((l) => /^- /.test(l)).map((l) => `<li>${esc(l.slice(2))}</li>`).join('');

const html = `<title>Please Hold Balance Report</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Pixelify+Sans:wght@500;700&family=Atkinson+Hyperlegible:wght@400;700&family=IBM+Plex+Mono:wght@400;600&display=swap">
<style>
/* Layout: one reading column with wide figure panels, set like the game's own dialogue boxes. */
:root {
  --bg: #efe6d2; --panel: #f7f1e2; --ink: #1b1726; --muted: #5d566b; --line: #cfc3a6; --plea: #9a7d22; --sign: #c23a36; --sky: #2f63c4;
  --band: #e4d7b4; --s0: #c23a36; --s1: #e08a2e; --s2: #b49a2c; --s3: #4f9e45; --s4: #2f9e9a; --s5: #3f6fd8; --s6: #8b6bd9;
  --display: 'Pixelify Sans', 'Courier New', monospace; --body: 'Atkinson Hyperlegible', 'Segoe UI', system-ui, sans-serif; --mono: 'IBM Plex Mono', ui-monospace, Consolas, monospace;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
  --bg: #0d0b14; --panel: #17141f; --ink: #efe6d2; --muted: #a59fb3; --line: #2f2a3d; --plea: #dccb86; --sign: #ef5b55; --sky: #7fb7f0;
  --band: #2a2433; --s0: #ef5b55; --s1: #ef8a3a; --s2: #dccb86; --s3: #8fe0b9; --s4: #2fc1b5; --s5: #7fb7f0; --s6: #c4a8f0; color-scheme: dark } }
:root[data-theme="dark"] {
  --bg: #0d0b14; --panel: #17141f; --ink: #efe6d2; --muted: #a59fb3; --line: #2f2a3d; --plea: #dccb86; --sign: #ef5b55; --sky: #7fb7f0;
  --band: #2a2433; --s0: #ef5b55; --s1: #ef8a3a; --s2: #dccb86; --s3: #8fe0b9; --s4: #2fc1b5; --s5: #7fb7f0; --s6: #c4a8f0; color-scheme: dark }
body { background: var(--bg); color: var(--ink); font: 16px/1.6 var(--body); }
.wrap { max-width: 860px; margin: 0 auto; padding-inline: 20px; padding-block: 40px 64px; display: grid; gap: 40px; }
header { display: grid; gap: 14px; }
.sign { justify-self: start; font-family: var(--mono); font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--sign); border: 2px solid var(--sign); padding: 3px 10px; }
h1 { font-family: var(--display); font-weight: 700; font-size: clamp(34px, 6vw, 56px); line-height: 1.05; margin: 0; text-wrap: balance; }
h2 { font-family: var(--display); font-weight: 500; font-size: 26px; margin: 0; text-wrap: balance; }
p { margin: 0; max-width: 66ch; }
.lede { font-size: 18px; color: var(--muted); }
section { display: grid; gap: 14px; }
.facts { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; }
.fact { border-top: 3px solid var(--plea); padding-top: 8px; display: grid; gap: 2px; }
.fact b { font-family: var(--mono); font-size: 24px; font-variant-numeric: tabular-nums; }
.fact span { font-size: 13px; color: var(--muted); }
figure { margin: 0; background: var(--panel); border: 2px solid var(--line); padding: 16px; display: grid; gap: 10px; min-width: 0; }
figure svg { width: 100%; height: auto; display: block; }
figcaption { font-size: 14px; color: var(--muted); }
.grid { stroke: var(--line); stroke-width: 1; }
.band { fill: var(--band); }
.tick { fill: var(--muted); font: 11px var(--mono); }
.tick.strong { fill: var(--ink); font-weight: 600; }
.stem { stroke: var(--muted); stroke-width: 1.5; }
.dot-casual { fill: var(--sign); }
.dot-smart { fill: var(--sky); }
.dot-mash { fill: var(--panel); stroke: var(--muted); stroke-width: 1.5; }
.seg.s0 { fill: var(--s0); } .seg.s1 { fill: var(--s1); } .seg.s2 { fill: var(--s2); } .seg.s3 { fill: var(--s3); } .seg.s4 { fill: var(--s4); } .seg.s5 { fill: var(--s5); } .seg.s6 { fill: var(--s6); }
.legend { display: flex; flex-wrap: wrap; gap: 6px 16px; font-size: 13px; color: var(--muted); }
.key { display: inline-flex; align-items: center; gap: 6px; }
.key em { font-style: normal; font-family: var(--mono); color: var(--ink); }
.sw { width: 12px; height: 12px; display: inline-block; }
.sw.s0 { background: var(--s0); } .sw.s1 { background: var(--s1); } .sw.s2 { background: var(--s2); } .sw.s3 { background: var(--s3); } .sw.s4 { background: var(--s4); } .sw.s5 { background: var(--s5); } .sw.s6 { background: var(--s6); }
.dots { display: flex; flex-wrap: wrap; gap: 16px; font-size: 13px; color: var(--muted); }
.dots i { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 6px; vertical-align: -1px; }
.scroll { overflow-x: auto; min-width: 0; }
table { border-collapse: collapse; width: 100%; font-size: 14px; }
th { text-align: left; font: 600 11px var(--mono); letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); padding: 8px 10px; border-bottom: 2px solid var(--line); white-space: nowrap; }
td { padding: 8px 10px; border-bottom: 1px solid var(--line); white-space: nowrap; }
td.num { font-family: var(--mono); font-variant-numeric: tabular-nums; text-align: right; }
td.hl { color: var(--sign); font-weight: 600; }
.pill { font: 600 11px var(--mono); padding: 2px 8px; border: 1.5px solid currentColor; }
.pill.ok { color: var(--s3); } .pill.low { color: var(--muted); } .pill.req { color: var(--sky); }
ol, ul { margin: 0; padding-left: 20px; display: grid; gap: 6px; max-width: 70ch; }
li { font-size: 15px; }
.probs li { color: var(--muted); }
.slip { background: var(--panel); border: 2px dashed var(--plea); padding: 14px 16px; font-family: var(--mono); font-size: 13px; color: var(--muted); }
</style>
<div class="wrap">
<header>
  <span class="sign">Now serving: chapter ${m.chapters.length} of ${m.chapters.length}</span>
  <h1>Please Hold balance report</h1>
  <p class="lede">A headless simulator played the whole campaign of Please Hold with four kinds of player, then ran ${m.trials} trials of every boss from the state the campaign reached. This page shows how hard each boss is for each player, how much each chapter's new mechanic matters, and a Fun Index built from the battle logs.</p>
</header>
<section class="facts" aria-label="Summary">
  <div class="fact"><b>${(totalMin / 60).toFixed(1)} h</b><span>estimated play time</span></div>
  <div class="fact"><b>${Math.round(Math.min(...casualVals) * 100)} to ${Math.round(Math.max(...casualVals) * 100)}%</b><span>casual win rate on story bosses</span></div>
  <div class="fact"><b>${bosses.length}</b><span>boss fights simulated</span></div>
  <div class="fact"><b>${Math.round(m.chapters.reduce((s, c) => s + c.fun.index, 0) / m.chapters.length)}</b><span>mean Fun Index out of 100</span></div>
</section>
<section>
  <h2>How hard each boss is</h2>
  <p>Each column is one boss. The red dot is a casual player who attacks most of the time, heals when someone is low, and tries the newest tools now and then. The blue dot is a lookahead player that tests every move one turn ahead. The hollow dot only attacks and uses healing items. The shaded band is the target for the casual player: losing sometimes, winning most of the time.</p>
  <figure>${diffChart()}
    <div class="dots"><span><i style="background:var(--sign)"></i>Casual</span><span><i style="background:var(--sky)"></i>Lookahead</span><span><i style="border:1.5px solid var(--muted)"></i>Attack and items only</span></div>
    <figcaption>The Linemen fight in chapter 6 is a short story fight and is easy on purpose. Amen, second is the answer phase that ends the game, so it is meant to be won.</figcaption>
  </figure>
  <div class="scroll"><table>
    <thead><tr><th>Ch</th><th>Boss</th><th>Lookahead</th><th>Casual</th><th>Masher</th><th>Random</th><th>Actions</th><th>HP left</th><th>Lead flips</th><th>Close calls</th><th>Level vs boss</th></tr></thead>
    <tbody>${rows}</tbody>
  </table></div>
  <p>Actions are per fight for the lookahead player. HP left, lead flips, and close calls (comebacks plus near misses) are for the casual player, whose fights are the closest to a first playthrough.</p>
</section>
<section>
  <h2>Does each new mechanic matter?</h2>
  <p>For each chapter the simulator removed the chapter's new mechanic and played the boss again. The table shows the larger drop in win rate between the casual and the lookahead player.</p>
  <div class="scroll"><table><thead><tr><th>Ch</th><th>New mechanic</th><th>Win rate drop</th><th>Reading</th></tr></thead><tbody>${mechRows}</tbody></table></div>
</section>
<section>
  <h2>Fun Index by chapter</h2>
  <p>The Fun Index adds seven weighted parts, each scored from 0 to 1. Challenge rewards a boss that a casual player usually beats but not always. Tension rewards comebacks and near misses. Lead rewards fights where the advantage changes hands. Variety rewards a spread of actions. Relevance rewards a new mechanic that changes outcomes. Pacing rewards fights of a sensible length. Novelty counts new enemies, mechanics, and companions per ten minutes.</p>
  <figure>${funChart()}<figcaption>Bar height is the Fun Index. Hover a segment for its points.</figcaption></figure>
  <details><summary>Exact formula</summary><ul>${formulaLines}</ul></details>
</section>
<section>
  <h2>Pacing</h2>
  <div class="scroll"><table><thead><tr><th>Ch</th><th>Chapter</th><th>Minutes</th><th>Actions per fight</th><th>HP lost per fight</th><th>Retries</th><th>New things per 10 min</th></tr></thead><tbody>${chRows}</tbody></table></div>
  <p>Minutes are estimated from dialogue lines, fight lengths, and map size. Retries count regular fights the casual player lost during the campaign walk.</p>
</section>
<section>
  <h2>What the simulator still flags</h2>
  <ul class="probs">${probs.slice(0, 18).map((p) => `<li>${esc(p)}</li>`).join('')}</ul>
  <p class="slip">The lookahead player wins nearly every boss, which caps the challenge score. Tuning one boss to hold both a skilled player near 85 percent and a casual player near 60 percent was not possible, so bosses are tuned for the casual player.</p>
</section>
</div>`;

fs.writeFileSync('reports/report.html', html);
console.log('Wrote reports/report.html');
