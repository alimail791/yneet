// Builds puzzles.json (one entry per day) from content.js.
// Zip paths and Queens boards are generated here with a fixed seed, so the output is repeatable.
// Usage: node puzzles/generate.js [startDate YYYY-MM-DD] [days]
const fs = require('fs');
const path = require('path');
const C = require('./content');

const START = process.argv[2] || '2026-10-24';
const DAYS = +(process.argv[3] || 30);

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

// ---------- Build days ----------
const chapters = C.pinpoint.map(p => p[0]);
const out = {};
for (let d = 0; d < DAYS; d++) {
  const date = addDays(START, d);
  const r = rng(20261024 + d * 7919);
  const no = d + 2; // #1 was the launch demo on Oct 23
  const bw = C.bioword[d % C.bioword.length];
  const pp = C.pinpoint[d % C.pinpoint.length];
  const zp = C.zip[d % C.zip.length];
  const opts = shuffle([pp[0], ...shuffle(chapters.filter(c => c !== pp[0]), r).slice(0, 5)], r);
  const zipN = d < 15 ? 5 : 6;
  const qN = d < 15 ? 6 : 7;
  const qb = makeQueens(qN, r);
  const mcq = (src, i, subject) => {
    const [q, o, a, e] = src[i % src.length];
    const order = shuffle([0, 1, 2, 3], r);
    return { s: subject, q, o: order.map(k => o[k]), a: order.indexOf(a), e };
  };
  out[date] = {
    no, date,
    bioword: { answer: bw[0], hint: bw[1], fact: bw[2] },
    pinpoint: { answer: pp[0], clues: pp[1], options: opts },
    zip: { title: zp[0], labels: zp[1], ...makeZip(zp[1], zipN, r) },
    queens: { ...qb, names: Object.fromEntries([...new Set(qb.regions.join(''))].sort().map(k => [k, REGION_NAMES[k]])) },
    daily5: [mcq(C.bio, d * 3, 'Bio'), mcq(C.bio, d * 3 + 1, 'Bio'), mcq(C.chem, d, 'Chem'), mcq(C.bio, d * 3 + 2, 'Bio'), mcq(C.phy, d, 'Phy')]
  };
}
fs.writeFileSync(path.join(__dirname, 'puzzles.json'), JSON.stringify(out, null, 1));
console.log(`Wrote ${Object.keys(out).length} days: ${START} to ${addDays(START, DAYS - 1)}`);
