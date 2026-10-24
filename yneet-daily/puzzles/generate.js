// Builds puzzles.json (one entry per day) from content.js.
// Zip paths and Queens boards are generated here with a fixed seed, so the output is repeatable.
// Usage: node puzzles/generate.js [startDate YYYY-MM-DD] [days]   (defaults: 2026-10-24, 365 days)
// Days 1-30 come from content.js; days 31+ come from the files in puzzles/year/.
const fs = require('fs');
const path = require('path');
const C = require('./content');

const START = process.argv[2] || '2026-10-24';
const DAYS = +(process.argv[3] || 365);

function rng(seed) { // mulberry32
  let a = seed >>> 0;
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const shuffle = (arr, r) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const addDays = (d, n) => { const t = new Date(d + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };

// ---------- Zip: random Hamiltonian path on an N×N grid ----------
function hamiltonPath(N, r) {
  const total = N * N;
  const nb = i => { const x = i % N, y = Math.floor(i / N), o = []; if (x > 0) o.push(i - 1); if (x < N - 1) o.push(i + 1); if (y > 0) o.push(i - N); if (y < N - 1) o.push(i + N); return o; };
  for (let attempt = 0; attempt < 5000; attempt++) {
    const seen = new Uint8Array(total); const p = [Math.floor(r() * total)]; seen[p[0]] = 1;
    while (p.length < total) {
      const cur = p[p.length - 1];
      const opts = nb(cur).filter(n => !seen[n]);
      if (!opts.length) break;
      // Warnsdorff: prefer the neighbour with the fewest free exits, random tie-break
      const score = n => nb(n).filter(m => !seen[m]).length + r() * 0.9;
      opts.sort((a, b) => score(a) - score(b));
      p.push(opts[0]); seen[opts[0]] = 1;
    }
    if (p.length === total) return p;
  }
  throw new Error('no path');
}
function makeZip(steps, N, r) {
  const p = hamiltonPath(N, r);
  const k = steps.length, nodes = {};
  for (let i = 0; i < k; i++) nodes[p[Math.round(i * (p.length - 1) / (k - 1))]] = i + 1;
  return { size: N, nodes, solution: p };
}

// ---------- Queens: regions with exactly one solution ----------
function countQueenSolutions(N, reg, limit = 2) {
  let count = 0; const cols = new Array(N).fill(false), used = new Set(), place = [];
  (function go(r) {
    if (count >= limit) return;
    if (r === N) { count++; return; }
    for (let c = 0; c < N; c++) {
      if (cols[c] || used.has(reg[r][c])) continue;
      if (r > 0 && Math.abs(place[r - 1] - c) <= 1) continue;
      cols[c] = true; used.add(reg[r][c]); place[r] = c;
      go(r + 1);
      cols[c] = false; used.delete(reg[r][c]);
    }
  })(0);
  return count;
}
function makeQueens(N, r) {
  for (let attempt = 0; attempt < 20000; attempt++) {
    // a placement with one queen per row/column and no touching
    const q = []; let ok = true;
    const colsLeft = shuffle([...Array(N).keys()], r);
    (function place(row, avail) {
      if (row === N) return true;
      for (const c of shuffle(avail, r)) {
        if (row > 0 && Math.abs(q[row - 1] - c) <= 1) continue;
        q[row] = c;
        if (place(row + 1, avail.filter(x => x !== c))) return true;
      }
      return false;
    })(0, colsLeft) || (ok = false);
    if (!ok) continue;
    // grow regions from each queen by random flood fill
    const reg = [...Array(N)].map(() => Array(N).fill(-1));
    const frontier = [];
    q.forEach((c, row) => { reg[row][c] = row; frontier.push([row, c]); });
    let left = N * N - N;
    while (left > 0) {
      const idx = Math.floor(r() * frontier.length);
      const [y, x] = frontier[idx];
      const nbs = [[y - 1, x], [y + 1, x], [y, x - 1], [y, x + 1]].filter(([a, b]) => a >= 0 && b >= 0 && a < N && b < N && reg[a][b] === -1);
      if (!nbs.length) { frontier.splice(idx, 1); continue; }
      const [a, b] = nbs[Math.floor(r() * nbs.length)];
      reg[a][b] = reg[y][x]; frontier.push([a, b]); left--;
    }
    if (countQueenSolutions(N, reg) === 1) {
      return { size: N, regions: reg.map(row => row.map(v => 'ABCDEFGH'[v]).join('')), solution: q };
    }
  }
  throw new Error('no unique queens board');
}
const REGION_NAMES = { A: 's-block', B: 'p-block', C: 'd-block', D: 'f-block', E: 'Noble gases', F: 'Halogens', G: 'Metalloids', H: 'Lanthanoids' };

// ---------- Year content (days 31 onward) ----------
const YEAR = path.join(__dirname, 'year');
const lines = f => fs.readFileSync(path.join(YEAR, f), 'utf8').split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
const linesWithHeaders = f => fs.readFileSync(path.join(YEAR, f), 'utf8').split('\n').map(l => l.trim()).filter(Boolean);
// Round-robin across groups so neighbouring days come from different chapters.
const interleave = groups => { const out = [], g = groups.map(x => x.slice()); while (g.some(x => x.length)) for (const x of g) if (x.length) out.push(x.shift()); return out; };
// Merge several lists so each is spread evenly through the result.
const spread = lists => lists.flatMap(l => l.map((v, i) => ({ v, k: (i + 0.5) / l.length }))).sort((a, b) => a.k - b.k).map(x => x.v);

function yearPools() {
  const usedWords = new Set(C.bioword.map(b => b[0]));
  const words = lines('bioword.txt').map(l => l.split(' | ')).filter(w => !usedWords.has(w[0]));
  const pinBySubject = {};
  for (const l of lines('pinpoint.txt')) {
    const [subj, chap, clues] = l.split(' | ');
    ((pinBySubject[subj] ||= {})[chap] ||= []).push({ subj, chap, clues: clues.split('; ') });
  }
  const pinLists = Object.values(pinBySubject).map(byChap => interleave(Object.values(byChap)));
  const pins = spread(pinLists);
  const chaptersOf = subj => [...new Set([...Object.keys(pinBySubject[subj] || {}), ...(subj === 'Bio' ? C.pinpoint.map(p => p[0]) : [])])];
  const zips = lines('zip.txt').map(l => { const [t, s] = l.split(' | '); return [t, s.split(' > ')]; });
  const mcqs = { Bio: [], Chem: [], Phy: [] };
  for (const f of fs.readdirSync(YEAR).filter(f => f.startsWith('mcq_')).sort()) {
    const subj = f.includes('_bio') ? 'Bio' : f.includes('_chem') ? 'Chem' : 'Phy';
    let cur = null; const groups = [];
    for (const l of linesWithHeaders(f)) {
      if (l.startsWith('#')) { if (!l.startsWith('# Format')) { cur = []; groups.push(cur); } continue; }
      const [q, a, w1, w2, w3, e] = l.split(' | ');
      (cur || (cur = [], groups.push(cur), cur)).push([q, [a, w1, w2, w3], 0, e]);
    }
    mcqs[subj].push(groups);
  }
  for (const k in mcqs) mcqs[k] = interleave(mcqs[k].flat());
  return { words, pins, chaptersOf, zips, mcqs };
}

// Harder boards later in the week: Mon-Tue small, Wed-Fri medium, weekend large.
const SIZES = { zip: [7, 5, 5, 6, 6, 6, 7], queens: [8, 6, 6, 7, 7, 7, 8] }; // index = getUTCDay()

// ---------- Build days ----------
const FIRST = 30; // the first 30 days were published before the year set; keep them identical
const chapters = C.pinpoint.map(p => p[0]);
const Y = yearPools();
const out = {};
const regionNames = qb => Object.fromEntries([...new Set(qb.regions.join(''))].sort().map(k => [k, REGION_NAMES[k]]));
for (let d = 0; d < DAYS; d++) {
  const date = addDays(START, d);
  const r = rng(20261024 + d * 7919);
  const no = d + 2; // #1 was the launch demo on Oct 23
  const mcq = (src, i, subject) => {
    const [q, o, a, e] = src[i % src.length];
    const order = shuffle([0, 1, 2, 3], r);
    return { s: subject, q, o: order.map(k => o[k]), a: order.indexOf(a), e };
  };
  if (d < FIRST) {
    const bw = C.bioword[d % C.bioword.length];
    const pp = C.pinpoint[d % C.pinpoint.length];
    const zp = C.zip[d % C.zip.length];
    const opts = shuffle([pp[0], ...shuffle(chapters.filter(c => c !== pp[0]), r).slice(0, 5)], r);
    const zipN = d < 15 ? 5 : 6;
    const qN = d < 15 ? 6 : 7;
    const qb = makeQueens(qN, r);
    out[date] = {
      no, date,
      bioword: { answer: bw[0], hint: bw[1], fact: bw[2] },
      pinpoint: { answer: pp[0], clues: pp[1], options: opts },
      zip: { title: zp[0], labels: zp[1], ...makeZip(zp[1], zipN, r) },
      queens: { ...qb, names: regionNames(qb) },
      daily5: [mcq(C.bio, d * 3, 'Bio'), mcq(C.bio, d * 3 + 1, 'Bio'), mcq(C.chem, d, 'Chem'), mcq(C.bio, d * 3 + 2, 'Bio'), mcq(C.phy, d, 'Phy')]
    };
    continue;
  }
  const i = d - FIRST, dow = new Date(date + 'T00:00:00Z').getUTCDay();
  const bw = Y.words[i % Y.words.length];
  const pp = Y.pins[i % Y.pins.length];
  const zp = Y.zips[i % Y.zips.length];
  const opts = shuffle([pp.chap, ...shuffle(Y.chaptersOf(pp.subj).filter(c => c !== pp.chap), r).slice(0, 5)], r);
  const qb = makeQueens(SIZES.queens[dow], r);
  out[date] = {
    no, date,
    bioword: { answer: bw[0], hint: bw[1], fact: bw[2] },
    pinpoint: { answer: pp.chap, subject: pp.subj, clues: pp.clues, options: opts },
    zip: { title: zp[0], labels: zp[1], ...makeZip(zp[1], SIZES.zip[dow], r) },
    queens: { ...qb, names: regionNames(qb) },
    daily5: [mcq(Y.mcqs.Bio, i * 3, 'Bio'), mcq(Y.mcqs.Bio, i * 3 + 1, 'Bio'), mcq(Y.mcqs.Chem, i, 'Chem'), mcq(Y.mcqs.Bio, i * 3 + 2, 'Bio'), mcq(Y.mcqs.Phy, i, 'Phy')]
  };
}
const used = { BioWord: Y.words.length, Pinpoint: Y.pins.length, Zip: Y.zips.length, 'Bio MCQ': Y.mcqs.Bio.length / 3, 'Chem MCQ': Y.mcqs.Chem.length, 'Phy MCQ': Y.mcqs.Phy.length };
const short = Object.entries(used).filter(([, n]) => FIRST + n < DAYS).map(([k, n]) => `${k} (${FIRST + Math.floor(n)} days)`);
if (short.length) console.warn('Warning: content repeats before the end for: ' + short.join(', '));
fs.writeFileSync(path.join(__dirname, 'puzzles.json'), JSON.stringify(out, null, 1));
console.log(`Wrote ${Object.keys(out).length} days: ${START} to ${addDays(START, DAYS - 1)}`);
