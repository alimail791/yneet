// Builds a one-page review sheet of every puzzle with answers marked. Usage: node puzzles/review.js out.html
const fs = require('fs'); const P = require('./puzzles.json');
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const col = { A: 'var(--r1)', B: 'var(--r2)', C: 'var(--r3)', D: 'var(--r4)', E: 'var(--r5)', F: 'var(--r6)', G: 'var(--r7)', H: 'var(--r8)' };
const dl = d => new Date(d + 'T00:00:00Z').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
let lastMonth = '';
const days = Object.values(P).map((p, i) => {
  const month = new Date(p.date + 'T00:00:00Z').toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const head = month !== lastMonth ? `<h2 class="month">${month}</h2>` : ''; lastMonth = month;
  const q = p.queens, N = q.size;
  const board = `<div class="qb" style="grid-template-columns:repeat(${N},1fr)">${q.regions.map((row, r) => [...row].map((k, c) => `<i style="background:${col[k]}">${q.solution[r] === c ? '⚛' : ''}</i>`).join('')).join('')}</div>`;
  return head + `<details ${i === 0 ? 'open' : ''} id="d${p.no}"><summary><span class="no">#${p.no}</span><span class="dt">${dl(p.date)}</span><span class="peek">${esc(p.bioword.answer)} · ${esc(p.pinpoint.answer)}</span></summary>
  <div class="grid">
    <section><h3>BioWord</h3><p class="big">${esc(p.bioword.answer)}</p><p><b>Hint:</b> ${esc(p.bioword.hint)}</p><p class="muted">${esc(p.bioword.fact)}</p></section>
    <section><h3>Pinpoint NEET · ${p.pinpoint.subject || 'Bio'}</h3><p class="ans">${esc(p.pinpoint.answer)}</p><ol>${p.pinpoint.clues.map(c => `<li>${esc(c)}</li>`).join('')}</ol><p class="muted">Other options: ${p.pinpoint.options.filter(o => o !== p.pinpoint.answer).map(esc).join(' · ')}</p></section>
    <section><h3>Pathway Zip · ${p.zip.size}×${p.zip.size}</h3><p class="ans">${esc(p.zip.title)}</p><ol>${p.zip.labels.map(c => `<li>${esc(c)}</li>`).join('')}</ol></section>
    <section><h3>Element Queens · ${N}×${N}</h3>${board}<p class="muted">One solution, shown with ⚛</p></section>
    <section class="wide"><h3>Daily 5</h3>${p.daily5.map((m, k) => `<div class="mcq"><p><span class="tag">${m.s}</span> ${esc(m.q)}</p><ul>${m.o.map((o, j) => `<li class="${j === m.a ? 'ok' : ''}">${'ABCD'[j]}. ${esc(o)}</li>`).join('')}</ul><p class="muted">${esc(m.e)}</p></div>`).join('')}</section>
  </div></details>`;
}).join('\n');
const first = Object.values(P)[0], last = Object.values(P).slice(-1)[0];
const html = `<title>YNeet Daily Puzzle Review</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800&family=Figtree:wght@400;600;700&family=JetBrains+Mono:wght@500;700&display=swap">
<style>
/* Layout: one column of collapsible days; inside each, a 2-column grid of game cards that stacks on phones */
:root{--bg:#eef3ef;--surface:#fff;--ink:#13221d;--muted:#5a6b65;--line:#d3ddd8;--accent:#0b7a5c;--ok:#d7f0e2;--okink:#0b5a40;--hi:#ffd23f;
--r1:#cfe7d8;--r2:#d6e1fb;--r3:#fde2c4;--r4:#e6dcfa;--r5:#fbd7d5;--r6:#f4efc1;--r7:#d9eef0;--r8:#efdcc9;
--display:"Bricolage Grotesque","Arial Black",system-ui,sans-serif;--body:"Figtree",system-ui,sans-serif;--mono:"JetBrains Mono",ui-monospace,monospace}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#0e1614;--surface:#16211e;--ink:#e6efeb;--muted:#94a6a0;--line:#2a3833;--accent:#36c895;--ok:#1d4636;--okink:#bff0d8;--hi:#f2c744;
--r1:#24463a;--r2:#283a63;--r3:#5a4126;--r4:#3e3166;--r5:#5c2f2d;--r6:#4f4a22;--r7:#1f4a4f;--r8:#4d3a2a;color-scheme:dark}}
:root[data-theme="dark"]{--bg:#0e1614;--surface:#16211e;--ink:#e6efeb;--muted:#94a6a0;--line:#2a3833;--accent:#36c895;--ok:#1d4636;--okink:#bff0d8;--hi:#f2c744;
--r1:#24463a;--r2:#283a63;--r3:#5a4126;--r4:#3e3166;--r5:#5c2f2d;--r6:#4f4a22;--r7:#1f4a4f;--r8:#4d3a2a;color-scheme:dark}
*{box-sizing:border-box}body{background:var(--bg);color:var(--ink);font-family:var(--body);font-size:15px;line-height:1.45;
padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px));padding-block:20px 48px}
.wrap{max-width:960px;margin:0 auto;display:flex;flex-direction:column;gap:10px}
h1{font-family:var(--display);font-weight:800;font-size:30px;margin:0;text-wrap:balance}h1 span{background:var(--hi);color:#2b2200;padding:0 6px;border-radius:4px}
.lede{color:var(--muted);margin:0 0 8px;max-width:65ch}
.month{font-family:var(--display);font-size:20px;margin:18px 0 2px}
details{background:var(--surface);border:1px solid var(--line);border-radius:12px}
summary{display:flex;gap:12px;align-items:baseline;padding:12px 16px;cursor:pointer;list-style:none}summary::-webkit-details-marker{display:none}
summary:focus-visible{outline:3px solid var(--hi);border-radius:12px}
.no{font-family:var(--mono);font-weight:700;color:var(--accent);width:40px}.dt{font-weight:700;width:110px}.peek{color:var(--muted);font-size:14px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:0 16px 16px}
section{border-top:1px solid var(--line);padding-top:10px;min-width:0}section.wide{grid-column:1/-1}
h3{font-family:var(--mono);font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin:0 0 6px}
p{margin:4px 0}.big{font-family:var(--display);font-size:28px;font-weight:800;letter-spacing:.08em}.ans{font-weight:700}.muted{color:var(--muted);font-size:13px}
ol{margin:4px 0;padding-left:22px}
.qb{display:grid;width:min(100%,200px);border:2px solid var(--ink);border-radius:8px;overflow:hidden}.qb i{aspect-ratio:1;display:grid;place-items:center;font-style:normal;font-size:15px;border:1px solid color-mix(in srgb,var(--ink) 15%,transparent)}
.mcq{padding:8px 0;border-bottom:1px dashed var(--line)}.mcq:last-child{border:0}.mcq ul{list-style:none;padding:0;margin:4px 0;display:grid;grid-template-columns:1fr 1fr;gap:4px}
.mcq li{padding:4px 8px;border-radius:6px;font-size:14px}.mcq li.ok{background:var(--ok);color:var(--okink);font-weight:700}
.tag{font-family:var(--mono);font-size:11px;background:var(--bg);border:1px solid var(--line);padding:1px 6px;border-radius:99px}
@media (max-width:640px){.grid{grid-template-columns:1fr}.mcq ul{grid-template-columns:1fr}.dt{width:auto}}
</style>
<div class="wrap">
<h1>YNeet <span>Daily</span> puzzle review</h1>
<p class="lede">${Object.keys(P).length} days, ${dl(first.date)} to ${dl(last.date)} (#${first.no}–#${last.no}). One new set of five puzzles every day for a year, then the cycle repeats. Correct answers are highlighted. Tap a day to open it. Board sizes grow through the week: small on Monday and Tuesday, largest at the weekend.</p>
${days}
</div>`;
fs.writeFileSync(process.argv[2] || 'review.html', html);
console.log('ok', html.length);
