export interface BossRow { group: string; name: string; lvl: number; smart: number; casual: number; mash: number; random: number; turns: number; minFrac: number }

export interface ChapterRow {
  ch: number;
  title: string;
  fun: number;
  parts: Record<string, number>;
  start: number;
  boss: number;
  end: number;
  enemyBossLvl: number;
  battles: number;
  losses: number;
  minutes: number;
  words: number;
  errors: string[];
  bosses: BossRow[];
}

export interface ReportData {
  generated: string;
  seeds: number;
  trials: number;
  chapters: ChapterRow[];
  checks: string[];
}

const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

/** Renders a self-contained HTML report with SVG charts, hover tooltips, and a table under each chart. */
export function renderReport(d: ReportData): string {
  const chapters = d.chapters;
  const totalMin = chapters.reduce((s, c) => s + c.minutes, 0);
  const totalBattles = chapters.reduce((s, c) => s + c.battles, 0);
  const meanFun = chapters.length ? chapters.reduce((s, c) => s + c.fun, 0) / chapters.length : 0;
  const errors = chapters.flatMap(c => c.errors.map(e => `Chapter ${c.ch}: ${e}`));
  const partNames = chapters[0] ? Object.keys(chapters[0].parts) : [];
  const bossRows = chapters.flatMap(c => c.bosses.map(b => ({ ...b, ch: c.ch })));
  const data = JSON.stringify({ chapters, partNames, bossRows });

  const table = (head: string[], rows: (string | number)[][]) =>
    `<table><thead><tr>${head.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${esc(String(c))}</td>`).join('')}</tr>`).join('')}</tbody></table>`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Duotone balance report</title>
<style>
.viz-root {
  color-scheme: light;
  --page: #f9f9f7; --surface-1: #fcfcfb; --text-primary: #0b0b0b; --text-secondary: #52514e; --muted: #898781;
  --grid: #e1e0d9; --axis: #c3c2b7; --border: rgba(11,11,11,0.10);
  --series-1: #2a78d6; --series-2: #eb6834; --series-3: #1baf7a; --series-4: #eda100;
  --seq-0: #cde2fb; --seq-1: #9ec5f4; --seq-2: #6da7ec; --seq-3: #3987e5; --seq-4: #256abf; --seq-5: #184f95; --seq-6: #0d366b;
  --critical: #d03b3b; --good: #006300;
}
@media (prefers-color-scheme: dark) {
  :root:where(:not([data-theme="light"])) .viz-root {
    color-scheme: dark;
    --page: #0d0d0d; --surface-1: #1a1a19; --text-primary: #ffffff; --text-secondary: #c3c2b7; --muted: #898781;
    --grid: #2c2c2a; --axis: #383835; --border: rgba(255,255,255,0.10);
    --series-1: #3987e5; --series-2: #d95926; --series-3: #199e70; --series-4: #c98500;
    --seq-0: #184f95; --seq-1: #1c5cab; --seq-2: #256abf; --seq-3: #2a78d6; --seq-4: #5598e7; --seq-5: #86b6ef; --seq-6: #cde2fb;
    --critical: #e66767; --good: #0ca30c;
  }
}
:root[data-theme="dark"] .viz-root {
  color-scheme: dark;
  --page: #0d0d0d; --surface-1: #1a1a19; --text-primary: #ffffff; --text-secondary: #c3c2b7; --muted: #898781;
  --grid: #2c2c2a; --axis: #383835; --border: rgba(255,255,255,0.10);
  --series-1: #3987e5; --series-2: #d95926; --series-3: #199e70; --series-4: #c98500;
  --seq-0: #184f95; --seq-1: #1c5cab; --seq-2: #256abf; --seq-3: #2a78d6; --seq-4: #5598e7; --seq-5: #86b6ef; --seq-6: #cde2fb;
  --critical: #e66767; --good: #0ca30c;
}
html, body { margin: 0; }
body.viz-root { background: var(--page); color: var(--text-primary); font: 15px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; }
main { max-width: 980px; margin: 0 auto; padding: 32px 16px 64px; }
h1 { font-size: 28px; margin: 0 0 4px; }
h2 { font-size: 19px; margin: 40px 0 4px; }
p.sub, .note { color: var(--text-secondary); margin: 0 0 16px; }
.tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px; margin: 24px 0; }
.tile { background: var(--surface-1); border: 1px solid var(--border); border-radius: 10px; padding: 14px 16px; }
.tile .v { font-size: 30px; font-weight: 650; }
.tile .k { color: var(--text-secondary); font-size: 13px; }
.card { background: var(--surface-1); border: 1px solid var(--border); border-radius: 10px; padding: 16px; margin-top: 12px; overflow-x: auto; }
svg { display: block; width: 100%; height: auto; }
svg text { fill: var(--muted); font: 12px system-ui, -apple-system, "Segoe UI", sans-serif; }
svg text.lbl { fill: var(--text-secondary); }
.legend { display: flex; flex-wrap: wrap; gap: 16px; margin: 0 0 8px; color: var(--text-secondary); font-size: 13px; }
.legend span { display: inline-flex; align-items: center; gap: 6px; }
.legend i { width: 12px; height: 12px; border-radius: 3px; display: inline-block; }
details { margin-top: 10px; }
summary { cursor: pointer; color: var(--text-secondary); font-size: 13px; }
table { border-collapse: collapse; width: 100%; font-size: 13px; margin-top: 8px; font-variant-numeric: tabular-nums; }
th, td { text-align: left; padding: 5px 8px; border-bottom: 1px solid var(--grid); white-space: nowrap; }
th { color: var(--text-secondary); font-weight: 600; }
#tip { position: fixed; pointer-events: none; background: var(--surface-1); color: var(--text-primary); border: 1px solid var(--border); border-radius: 8px; padding: 6px 10px; font-size: 13px; box-shadow: 0 4px 16px rgba(0,0,0,0.18); display: none; z-index: 10; }
.err { color: var(--critical); }
ul { padding-left: 20px; }
</style>
</head>
<body class="viz-root">
<main>
<h1>Duotone balance report</h1>
<p class="sub">Generated ${esc(d.generated)} from ${d.seeds} bot playthroughs and ${d.trials} simulated battles per boss and policy.</p>
<div class="tiles">
  <div class="tile"><div class="v">${chapters.length}/8</div><div class="k">chapters completed by the bot</div></div>
  <div class="tile"><div class="v">${Math.round(meanFun)}</div><div class="k">mean fun index (0 to 100)</div></div>
  <div class="tile"><div class="v">${Math.round(totalMin)} min</div><div class="k">estimated play time</div></div>
  <div class="tile"><div class="v">${Math.round(totalBattles)}</div><div class="k">battles in one playthrough</div></div>
</div>
${errors.length ? `<p class="err">Route errors: ${esc(errors.join('; '))}</p>` : ''}

<h2>Fun index by chapter</h2>
<p class="note">A weighted score of twelve measurable proxies, each checked against a target band. The method section below defines them.</p>
<div class="card"><div id="funChart"></div>
<details><summary>Table</summary>${table(['Chapter', 'Title', 'Fun index'], chapters.map(c => [c.ch, c.title, c.fun]))}</details></div>

<h2>What each chapter scores well and badly on</h2>
<p class="note">The strongest blue scores highest, and cells closest to the card color score lowest. Hover a cell for its score.</p>
<div class="card"><div id="heat"></div>
<details><summary>Table</summary>${table(['Chapter', ...partNames], chapters.map(c => [c.ch, ...partNames.map(p => Math.round(c.parts[p] * 100))]))}</details></div>

<h2>Boss win rate by player skill</h2>
<p class="note">Each boss is fought from the bot's saved state right before the fight. Smart reads hues, heals, and guards telegraphs. Casual plays smart two thirds of the time. Mash attacks every turn. Random picks any legal action.</p>
<div class="card"><div class="legend"><span><i style="background:var(--series-1)"></i>Smart</span><span><i style="background:var(--series-2)"></i>Casual</span><span><i style="background:var(--series-3)"></i>Mash</span><span><i style="background:var(--series-4)"></i>Random</span></div><div id="bossChart"></div>
<details><summary>Table</summary>${table(['Chapter', 'Boss', 'Party level', 'Smart', 'Casual', 'Mash', 'Random', 'Smart turns', 'Lowest HP'], bossRows.map(b => [b.ch, b.name, b.lvl, pct(b.smart), pct(b.casual), pct(b.mash), pct(b.random), b.turns.toFixed(1), pct(b.minFrac)]))}</details></div>

<h2>Level curve</h2>
<p class="note">The bot's average party level at each chapter's start, boss, and end, against the level of that chapter's boss.</p>
<div class="card"><div class="legend"><span><i style="background:var(--series-1)"></i>Party level</span><span><i style="background:var(--series-2)"></i>Boss level</span></div><div id="lvlChart"></div>
<details><summary>Table</summary>${table(['Chapter', 'Start', 'At boss', 'End', 'Boss level', 'Battles', 'Losses'], chapters.map(c => [c.ch, c.start.toFixed(1), c.boss.toFixed(1), c.end.toFixed(1), c.enemyBossLvl, c.battles.toFixed(1), c.losses.toFixed(1)]))}</details></div>

<h2>Estimated minutes per chapter</h2>
<p class="note">Walking at 9 frames a tile, about 5.6 seconds per party turn in battle, reading at 190 words a minute, and 40 seconds per shop visit.</p>
<div class="card"><div id="minChart"></div>
<details><summary>Table</summary>${table(['Chapter', 'Minutes', 'Dialogue words'], chapters.map(c => [c.ch, c.minutes.toFixed(1), Math.round(c.words)]))}</details></div>

<h2>Method</h2>
<ul>
<li><b>Challenge</b> wants the smart player to beat the chapter boss 60 to 92 percent of the time.</li>
<li><b>Agency</b> wants the smart player to beat the masher by at least 25 points, so decisions matter.</li>
<li><b>Tension</b> wants the smart player's lowest party HP in a won boss fight to land between 8 and 40 percent.</li>
<li><b>Boss pacing</b> wants 9 to 26 party turns per boss. <b>Trash pacing</b> wants 2.5 to 7 per random fight.</li>
<li><b>Attrition</b> wants a random fight to cost 8 to 30 percent of party HP. <b>Skill matters</b> wants mashing to cost at least 3 points more.</li>
<li><b>Variety</b> wants a normalized action entropy of 0.6 or more with no single action above 45 percent.</li>
<li><b>No grind</b> wants the bot to lose no fights and never grind. <b>Novelty</b> wants at least four points of new content per chapter.</li>
<li><b>Hue use</b> wants 30 to 90 percent of damaging actions to hit a weakness from chapter 2 on. <b>Length</b> wants 12 to 45 minutes.</li>
</ul>
${d.checks.length ? `<p class="err">Content checks: ${esc(d.checks.join('; '))}</p>` : '<p class="note">Content checks: every map, warp, encounter group, enemy, and skill resolves.</p>'}
</main>
<div id="tip"></div>
<script>
const D = ${data};
const tip = document.getElementById('tip');
const css = n => getComputedStyle(document.body).getPropertyValue(n).trim();
function show(e, html) { tip.innerHTML = html; tip.style.display = 'block'; tip.style.left = (e.clientX + 14) + 'px'; tip.style.top = (e.clientY + 14) + 'px'; }
function hide() { tip.style.display = 'none'; }
const NS = 'http://www.w3.org/2000/svg';
function el(tag, attrs, parent) { const n = document.createElementNS(NS, tag); for (const k in attrs) n.setAttribute(k, attrs[k]); if (parent) parent.appendChild(n); return n; }
function svg(host, w, h) { const s = el('svg', { viewBox: '0 0 ' + w + ' ' + h, role: 'img' }); document.getElementById(host).appendChild(s); return s; }
function barPath(x, y, w, h) { const r = Math.min(4, w / 2, h); return 'M' + x + ',' + (y + h) + 'V' + (y + r) + 'Q' + x + ',' + y + ' ' + (x + r) + ',' + y + 'H' + (x + w - r) + 'Q' + (x + w) + ',' + y + ' ' + (x + w) + ',' + (y + r) + 'V' + (y + h) + 'Z'; }
function axisY(s, x0, x1, y0, h, max, ticks, fmt) {
  for (let i = 0; i <= ticks; i++) { const v = max * i / ticks; const y = y0 + h - h * i / ticks;
    el('line', { x1: x0, x2: x1, y1: y, y2: y, stroke: i ? css('--grid') : css('--axis'), 'stroke-width': 1 }, s);
    const t = el('text', { x: x0 - 6, y: y + 4, 'text-anchor': 'end' }, s); t.textContent = fmt(v); }
}
function bars(host, labels, values, max, fmt, tipFn) {
  const W = 900, H = 260, L = 44, B = 30, T = 12, n = labels.length, band = (W - L - 10) / n, bw = Math.min(56, band * 0.6);
  const s = svg(host, W, H); axisY(s, L, W - 10, T, H - T - B, max, 4, fmt);
  labels.forEach((lab, i) => { const v = values[i]; const h = (H - T - B) * v / max; const x = L + band * i + (band - bw) / 2; const y = T + (H - T - B) - h;
    const p = el('path', { d: barPath(x, y, bw, Math.max(0.5, h)), fill: css('--series-1') }, s);
    const hit = el('rect', { x: L + band * i, y: T, width: band, height: H - T - B, fill: 'transparent' }, s);
    hit.addEventListener('mousemove', e => { p.setAttribute('opacity', 0.85); show(e, tipFn(i)); }); hit.addEventListener('mouseleave', () => { p.setAttribute('opacity', 1); hide(); });
    const t = el('text', { x: L + band * i + band / 2, y: H - 10, 'text-anchor': 'middle', class: 'lbl' }, s); t.textContent = lab; });
}
bars('funChart', D.chapters.map(c => 'Ch ' + c.ch), D.chapters.map(c => c.fun), 100, v => Math.round(v), i => '<b>Chapter ' + D.chapters[i].ch + ': ' + D.chapters[i].title + '</b><br>Fun index ' + D.chapters[i].fun);
bars('minChart', D.chapters.map(c => 'Ch ' + c.ch), D.chapters.map(c => c.minutes), Math.max(10, Math.ceil(Math.max(...D.chapters.map(c => c.minutes)) / 10) * 10), v => Math.round(v), i => '<b>Chapter ' + D.chapters[i].ch + '</b><br>' + D.chapters[i].minutes.toFixed(1) + ' minutes, ' + Math.round(D.chapters[i].words) + ' words of dialogue');
(function heat() {
  const P = D.partNames, C = D.chapters, cw = 66, ch = 26, L = 56, T = 64, W = L + cw * P.length + 8, H = T + ch * C.length + 8;
  const s = svg('heat', W, H); const steps = ['--seq-0', '--seq-1', '--seq-2', '--seq-3', '--seq-4', '--seq-5', '--seq-6'];
  P.forEach((p, j) => { const t = el('text', { x: L + cw * j + cw / 2, y: T - 10, 'text-anchor': 'start', transform: 'rotate(-35 ' + (L + cw * j + cw / 2) + ' ' + (T - 10) + ')', class: 'lbl' }, s); t.textContent = p; });
  C.forEach((c, i) => { const t = el('text', { x: L - 8, y: T + ch * i + ch / 2 + 4, 'text-anchor': 'end', class: 'lbl' }, s); t.textContent = 'Ch ' + c.ch;
    P.forEach((p, j) => { const v = c.parts[p]; const k = Math.min(6, Math.floor(v * 6.999));
      const r = el('rect', { x: L + cw * j + 1, y: T + ch * i + 1, width: cw - 2, height: ch - 2, rx: 3, fill: css(steps[k]) }, s);
      r.addEventListener('mousemove', e => show(e, '<b>Chapter ' + c.ch + ', ' + p + '</b><br>' + Math.round(v * 100) + ' / 100')); r.addEventListener('mouseleave', hide); }); });
})();
(function bossChart() {
  const R = D.bossRows, keys = ['smart', 'casual', 'mash', 'random'], cols = ['--series-1', '--series-2', '--series-3', '--series-4'];
  const W = 900, H = 280, L = 44, B = 44, T = 12, band = (W - L - 10) / Math.max(1, R.length), gw = Math.min(18, (band - 10) / 4);
  const s = svg('bossChart', W, H); axisY(s, L, W - 10, T, H - T - B, 1, 4, v => Math.round(v * 100) + '%');
  R.forEach((r, i) => { const x0 = L + band * i + (band - (gw * 4 + 6)) / 2; const marks = [];
    keys.forEach((k, j) => { const v = r[k]; const h = (H - T - B) * v; const x = x0 + j * (gw + 2); const y = T + (H - T - B) - h;
      marks.push(el('path', { d: barPath(x, y, gw, Math.max(0.5, h)), fill: css(cols[j]) }, s)); });
    const hit = el('rect', { x: L + band * i, y: T, width: band, height: H - T - B, fill: 'transparent' }, s);
    hit.addEventListener('mousemove', e => show(e, '<b>Ch ' + r.ch + ': ' + r.name + '</b> at level ' + r.lvl + '<br>' + keys.map(k => k + ' ' + Math.round(r[k] * 100) + '%').join('<br>')));
    hit.addEventListener('mouseleave', hide);
    const t = el('text', { x: L + band * i + band / 2, y: H - 26, 'text-anchor': 'middle', class: 'lbl' }, s); t.textContent = 'Ch ' + r.ch;
    const t2 = el('text', { x: L + band * i + band / 2, y: H - 10, 'text-anchor': 'middle' }, s); t2.textContent = r.group; });
})();
(function lvl() {
  const C = D.chapters, W = 900, H = 260, L = 44, B = 30, T = 12, max = Math.ceil(Math.max(...C.map(c => Math.max(c.end, c.enemyBossLvl))) / 5) * 5;
  const s = svg('lvlChart', W, H); axisY(s, L, W - 10, T, H - T - B, max, 5, v => Math.round(v));
  const pts = []; C.forEach((c, i) => { pts.push([i, 0, c.start], [i, 0.5, c.boss], [i, 0.95, c.end]); });
  const X = (i, f) => L + ((W - L - 30) / Math.max(1, C.length)) * (i + f) + 10, Y = v => T + (H - T - B) * (1 - v / max);
  el('path', { d: pts.map((p, k) => (k ? 'L' : 'M') + X(p[0], p[1]) + ',' + Y(p[2])).join(''), fill: 'none', stroke: css('--series-1'), 'stroke-width': 2 }, s);
  el('path', { d: C.map((c, i) => (i ? 'L' : 'M') + X(i, 0.5) + ',' + Y(c.enemyBossLvl)).join(''), fill: 'none', stroke: css('--series-2'), 'stroke-width': 2 }, s);
  C.forEach((c, i) => {
    el('circle', { cx: X(i, 0.5), cy: Y(c.boss), r: 4, fill: css('--series-1'), stroke: css('--surface-1'), 'stroke-width': 2 }, s);
    el('circle', { cx: X(i, 0.5), cy: Y(c.enemyBossLvl), r: 4, fill: css('--series-2'), stroke: css('--surface-1'), 'stroke-width': 2 }, s);
    const t = el('text', { x: X(i, 0.5), y: H - 10, 'text-anchor': 'middle', class: 'lbl' }, s); t.textContent = 'Ch ' + c.ch;
    const hit = el('rect', { x: X(i, 0), y: T, width: X(i, 1) - X(i, 0), height: H - T - B, fill: 'transparent' }, s);
    hit.addEventListener('mousemove', e => show(e, '<b>Chapter ' + c.ch + '</b><br>Party level: start ' + c.start.toFixed(1) + ', boss ' + c.boss.toFixed(1) + ', end ' + c.end.toFixed(1) + '<br>Boss level ' + c.enemyBossLvl));
    hit.addEventListener('mouseleave', hide);
  });
  const last = C.length - 1;
  if (last >= 0) { const a = el('text', { x: X(last, 0.95) + 6, y: Y(C[last].end) - 6, class: 'lbl' }, s); a.textContent = 'Party';
    const b2 = el('text', { x: X(last, 0.5) + 6, y: Y(C[last].enemyBossLvl) + 16, class: 'lbl' }, s); b2.textContent = 'Boss'; }
})();
</script>
</body>
</html>`;
}

function pct(v: number): string {
  return Number.isFinite(v) ? `${Math.round(v * 100)}%` : 'n/a';
}
