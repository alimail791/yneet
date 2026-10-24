// Puzzle loading, public (answer-free) views, live answer checks and result verification.
const path = require('path');
const ALL = require(path.join(__dirname, '..', 'puzzles', 'puzzles.json'));
const DATES = Object.keys(ALL).sort();

const istToday = () => new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
const dayDiff = (a, b) => Math.round((new Date(a + 'T00:00:00Z') - new Date(b + 'T00:00:00Z')) / 86400e3);

// The puzzle for a calendar date. If the set has run out, it cycles so the page is never empty
// (the server logs a warning so you know to generate more).
function puzzleFor(date) {
  if (ALL[date]) return ALL[date];
  const n = dayDiff(date, DATES[0]);
  const src = ALL[DATES[((n % DATES.length) + DATES.length) % DATES.length]];
  return { ...src, date, no: n + 2, recycled: true };
}
function today() { return process.env.PUZZLE_DATE || istToday(); }

function publicView(p) {
  return {
    date: p.date, no: p.no,
    bioword: { hint: p.bioword.hint, length: p.bioword.answer.length },
    pinpoint: { subject: p.pinpoint.subject || 'Bio', firstClue: p.pinpoint.clues[0], totalClues: p.pinpoint.clues.length, options: p.pinpoint.options },
    zip: { title: p.zip.title, labels: p.zip.labels, size: p.zip.size, nodes: p.zip.nodes },
    queens: { size: p.queens.size, regions: p.queens.regions, names: p.queens.names },
    daily5: p.daily5.map(q => ({ s: q.s, q: q.q, o: q.o })),
  };
}

// ---------- BioWord ----------
function scoreGuess(guess, ans) {
  const res = Array(ans.length).fill('a'), pool = {};
  for (let i = 0; i < ans.length; i++) { if (guess[i] === ans[i]) res[i] = 'c'; else pool[ans[i]] = (pool[ans[i]] || 0) + 1; }
  for (let i = 0; i < ans.length; i++) if (res[i] !== 'c' && pool[guess[i]]) { res[i] = 'p'; pool[guess[i]]--; }
  return res;
}
const EMO = { c: '🟩', p: '🟨', a: '⬜' };

function checkBioword(p, guess, attemptNo) {
  const ans = p.bioword.answer;
  guess = String(guess || '').toUpperCase();
  if (!/^[A-Z]+$/.test(guess) || guess.length !== ans.length) return { error: `Enter a ${ans.length}-letter word` };
  const res = scoreGuess(guess, ans), solved = guess === ans;
  const out = { res, solved };
  if (solved || attemptNo >= 6) { out.answer = ans; out.fact = p.bioword.fact; }
  return out;
}

// ---------- Pinpoint ----------
function checkPinpoint(p, option, guessNo) {
  const pp = p.pinpoint;
  if (!pp.options.includes(option)) return { error: 'Pick one of the chapters shown' };
  const correct = option === pp.answer;
  const out = { correct };
  if (!correct && guessNo < pp.clues.length) out.nextClue = pp.clues[guessNo];
  if (correct || guessNo >= pp.clues.length) { out.answer = pp.answer; out.clues = pp.clues; }
  return out;
}

// ---------- Daily 5 ----------
function checkDaily5(p, qi, option) {
  const q = p.daily5[qi];
  if (!q) return { error: 'No such question' };
  return { correct: option === q.a, answer: q.a, explanation: q.e };
}

// ---------- Verify a finished attempt and compute the official result ----------
const clampSec = s => Math.max(1, Math.min(3600, Math.round(+s || 0)));

function verify(p, game, at) {
  at = at || {};
  const seconds = clampSec(at.seconds);
  const mm = s => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');

  if (game === 'bioword') {
    const ans = p.bioword.answer, g = (at.guesses || []).map(x => String(x).toUpperCase());
    if (!g.length || g.length > 6 || g.some(x => !/^[A-Z]+$/.test(x) || x.length !== ans.length)) return { error: 'Invalid guesses' };
    const firstWin = g.indexOf(ans);
    if (firstWin !== -1 && firstWin !== g.length - 1) return { error: 'Guesses continue after the answer' };
    const solved = firstWin !== -1;
    if (!solved && g.length < 6) return { error: 'Game not finished' };
    return { solved, seconds, score: solved ? 7 - g.length : 0, line: solved ? `${g.length}/6` : 'X/6',
      emoji: g.map(x => scoreGuess(x, ans).map(r => EMO[r]).join('')).join('\n') };
  }

  if (game === 'pinpoint') {
    const pp = p.pinpoint, g = at.guesses || [];
    if (!g.length || g.length > pp.clues.length || new Set(g).size !== g.length || g.some(x => !pp.options.includes(x))) return { error: 'Invalid guesses' };
    const firstWin = g.indexOf(pp.answer);
    if (firstWin !== -1 && firstWin !== g.length - 1) return { error: 'Guesses continue after the answer' };
    const solved = firstWin !== -1;
    if (!solved && g.length < pp.clues.length) return { error: 'Game not finished' };
    return { solved, seconds, score: solved ? pp.clues.length + 1 - g.length : 0,
      line: solved ? `${g.length}/${pp.clues.length}` : `X/${pp.clues.length}`,
      emoji: g.map(x => x === pp.answer ? '✅' : '❌').join('') };
  }

  if (game === 'zip') {
    const z = p.zip, N = z.size, path = at.path || [];
    const last = Math.max(...Object.values(z.nodes));
    if (path.length !== N * N || new Set(path).size !== N * N || path.some(i => !Number.isInteger(i) || i < 0 || i >= N * N)) return { error: 'Path must fill every cell once' };
    let next = 1;
    for (let k = 0; k < path.length; k++) {
      const i = path[k];
      if (k > 0) { const j = path[k - 1]; if (Math.abs(i % N - j % N) + Math.abs(Math.floor(i / N) - Math.floor(j / N)) !== 1) return { error: 'Path jumps between cells' }; }
      const n = z.nodes[i];
      if (n) { if (n !== next) return { error: 'Numbers visited out of order' }; next++; }
      if (k === 0 && n !== 1) return { error: 'Path must start at 1' };
    }
    if (z.nodes[path[path.length - 1]] !== last) return { error: `Path must end at ${last}` };
    return { solved: true, seconds, score: 1, line: `⏱ ${mm(seconds)}`, emoji: `🧬 ${z.title}: connected` };
  }

  if (game === 'queens') {
    const q = p.queens, N = q.size, cells = at.cells || [];
    if (cells.length !== N) return { error: `Place exactly ${N} atoms` };
    const rows = new Set(), cols = new Set(), regs = new Set();
    for (const [r, c] of cells) {
      if (!(r >= 0 && r < N && c >= 0 && c < N)) return { error: 'Invalid cell' };
      rows.add(r); cols.add(c); regs.add(q.regions[r][c]);
    }
    if (rows.size !== N || cols.size !== N || regs.size !== N) return { error: 'One atom per row, column and block' };
    for (let a = 0; a < N; a++) for (let b = a + 1; b < N; b++)
      if (Math.abs(cells[a][0] - cells[b][0]) <= 1 && Math.abs(cells[a][1] - cells[b][1]) <= 1) return { error: 'Atoms are touching' };
    return { solved: true, seconds, score: 1, line: `⏱ ${mm(seconds)}`, emoji: '⚛️'.repeat(N) };
  }

  if (game === 'daily5') {
    const a = at.answers || [];
    if (a.length > 5) return { error: 'Too many answers' };
    const marks = p.daily5.map((q, i) => a[i] == null ? '⏳' : (a[i] === q.a ? '✅' : '❌'));
    const score = marks.filter(m => m === '✅').length;
    return { solved: score > 0, seconds: Math.min(seconds, 120), score, line: `${score}/5`, emoji: marks.join('') };
  }
  return { error: 'Unknown game' };
}

module.exports = { ALL, DATES, today, istToday, puzzleFor, publicView, checkBioword, checkPinpoint, checkDaily5, verify, dayDiff };
